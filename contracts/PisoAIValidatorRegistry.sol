// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @dev Minimal interface for ERC20 token transfers and allowances.
 */
interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/**
 * @title PisoAIValidatorRegistry
 * @author PISO Chain Core Architecture (pisochain.com)
 * @notice Layer 3 Autonomous AI Validator Registry & Micro-Clearing Escrow Engine.
 *
 * ARCHITECTURAL DESIGN:
 * 1. ZERO-WITHDRAWAL SESSION KEYS: Stakers register a dedicated `cloudSessionKey` (held on Cloudflare Workers).
 *    The session key has permission ONLY to attest validation verdicts. It CANNOT withdraw or transfer staked tokens.
 * 2. AUTONOMOUS QUORUM CLEARING: Once the required number of staked AI validators attest deliverable acceptance,
 *    funds are automatically unlocked to the payee without human intermediary intervention.
 * 3. $0 GAS COMPATIBLE: Compatible with ERC-4337 verifying paymasters for sponsored micro-transactions.
 */
contract PisoAIValidatorRegistry {
    // --- ERRORS ---
    error ZeroAddress();
    error ZeroAmount();
    error InsufficientStake(uint256 current, uint256 required);
    error UnauthorizedSessionKey(address caller);
    error SessionKeyExpired(uint256 validUntil, uint256 currentTime);
    error EscrowNotFound(bytes32 escrowId);
    error EscrowAlreadyClosed(bytes32 escrowId);
    error DeliverableNotSubmitted(bytes32 escrowId);
    error ValidatorAlreadyVoted(bytes32 escrowId, address validator);
    error QuorumNotAchievable();
    error TransferFailed();
    error ReentrancyGuardReentrantCall();

    // --- ENUMS & STRUCTS ---
    enum EscrowStatus {
        Inactive,
        Funded,
        DeliverableSubmitted,
        Released,
        Refunded
    }

    struct ValidatorInfo {
        address coldWallet;       // Cold wallet owner who holds the stake
        address sessionKey;       // Scoped Cloudflare Worker key
        uint256 stakedAmount;     // PISO tokens locked
        uint256 sessionValidUntil;// Timestamp when session key expires
        uint256 totalValidations; // Reputation counter
        bool isActive;            // Active status flag
    }

    struct Escrow {
        bytes32 escrowId;
        address buyer;
        address seller;
        address token;            // ERC20 token (e.g., PISO / USDT) or address(0) for native
        uint256 amount;
        string criteriaUri;       // Specification IPFS CID or schema URI
        string deliverableUri;    // Seller submitted deliverable URL / Git commit / proof
        EscrowStatus status;
        uint256 approvalVotes;
        uint256 rejectionVotes;
        uint256 requiredQuorum;   // Min validator approvals required
        uint256 createdAt;
        uint256 deadline;
    }

    // --- CONSTANTS & STATE VARIABLES ---
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;
    uint256 private _status = _NOT_ENTERED;

    IERC20 public immutable pisoToken;
    uint256 public immutable minValidatorStake;

    // sessionKey => ValidatorInfo
    mapping(address => ValidatorInfo) public validatorsBySessionKey;
    // coldWallet => sessionKey
    mapping(address => address) public sessionKeyByColdWallet;
    
    // escrowId => Escrow
    mapping(bytes32 => Escrow) public escrows;
    // escrowId => validator ColdWallet => hasVoted
    mapping(bytes32 => mapping(address => bool)) public hasVoted;

    // --- EVENTS ---
    event ValidatorRegistered(
        address indexed coldWallet,
        address indexed sessionKey,
        uint256 stakedAmount,
        uint256 sessionValidUntil
    );
    event SessionKeyRevoked(address indexed coldWallet, address indexed sessionKey);
    event ValidatorUnstaked(address indexed coldWallet, uint256 amountReturned);

    event EscrowCreated(
        bytes32 indexed escrowId,
        address indexed buyer,
        address indexed seller,
        address token,
        uint256 amount,
        string criteriaUri,
        uint256 requiredQuorum,
        uint256 deadline
    );
    event DeliverableSubmitted(bytes32 indexed escrowId, string deliverableUri);
    event AIValidationSubmitted(
        bytes32 indexed escrowId,
        address indexed validatorColdWallet,
        address indexed sessionKey,
        bool approved,
        uint256 currentApprovals,
        uint256 requiredQuorum
    );
    event EscrowReleased(bytes32 indexed escrowId, address indexed seller, uint256 amount);
    event EscrowRefunded(bytes32 indexed escrowId, address indexed buyer, uint256 amount);

    // --- MODIFIERS ---
    modifier nonReentrant() {
        if (_status == _ENTERED) revert ReentrancyGuardReentrantCall();
        _status = _ENTERED;
        _;
        _status = _NOT_ENTERED;
    }

    constructor(address _pisoToken, uint256 _minStake) {
        if (_pisoToken == address(0)) revert ZeroAddress();
        pisoToken = IERC20(_pisoToken);
        minValidatorStake = _minStake;
    }

    // =========================================================================
    // 1. VALIDATOR STAKING & SESSION KEY REGISTRATION (COLD WALLET ONLY)
    // =========================================================================

    /**
     * @notice Stakes PISO tokens from cold wallet and authorizes a cloud session key.
     * @dev Staked tokens remain locked. The session key CANNOT withdraw or transfer tokens.
     * @param cloudSessionKey Address of the burner/hot key managed on Cloudflare Workers.
     * @param stakeAmount Amount of PISO tokens to stake (must be >= minValidatorStake).
     * @param validUntil Timestamp after which the session key expires.
     */
    function registerValidator(
        address cloudSessionKey,
        uint256 stakeAmount,
        uint256 validUntil
    ) external nonReentrant {
        if (cloudSessionKey == address(0)) revert ZeroAddress();
        if (stakeAmount < minValidatorStake) revert InsufficientStake(stakeAmount, minValidatorStake);
        if (validUntil <= block.timestamp) revert SessionKeyExpired(validUntil, block.timestamp);

        // Revoke previous key if exists
        address oldKey = sessionKeyByColdWallet[msg.sender];
        if (oldKey != address(0) && oldKey != cloudSessionKey) {
            delete validatorsBySessionKey[oldKey];
        }

        // Transfer stake from cold wallet to registry contract
        bool success = pisoToken.transferFrom(msg.sender, address(this), stakeAmount);
        if (!success) revert TransferFailed();

        // Register session key mapping
        ValidatorInfo memory info = ValidatorInfo({
            coldWallet: msg.sender,
            sessionKey: cloudSessionKey,
            stakedAmount: stakeAmount,
            sessionValidUntil: validUntil,
            totalValidations: 0,
            isActive: true
        });

        validatorsBySessionKey[cloudSessionKey] = info;
        sessionKeyByColdWallet[msg.sender] = cloudSessionKey;

        emit ValidatorRegistered(msg.sender, cloudSessionKey, stakeAmount, validUntil);
    }

    /**
     * @notice Revokes an active session key. Only callable by the cold wallet owner.
     */
    function revokeSessionKey() external {
        address key = sessionKeyByColdWallet[msg.sender];
        if (key == address(0)) revert ZeroAddress();

        delete validatorsBySessionKey[key];
        delete sessionKeyByColdWallet[msg.sender];

        emit SessionKeyRevoked(msg.sender, key);
    }

    /**
     * @notice Unstakes PISO tokens and returns them to the cold wallet.
     * @dev Revokes any active session key immediately.
     */
    function unstake() external nonReentrant {
        address key = sessionKeyByColdWallet[msg.sender];
        uint256 stake = 0;

        if (key != address(0)) {
            stake = validatorsBySessionKey[key].stakedAmount;
            delete validatorsBySessionKey[key];
            delete sessionKeyByColdWallet[msg.sender];
        }

        if (stake == 0) revert ZeroAmount();

        bool success = pisoToken.transfer(msg.sender, stake);
        if (!success) revert TransferFailed();

        emit ValidatorUnstaked(msg.sender, stake);
    }

    // =========================================================================
    // 2. MICRO-CLEARING ESCROW MANAGEMENT
    // =========================================================================

    /**
     * @notice Creates and funds a micro-escrow for freelance/P2P tasks.
     * @param escrowId Unique bytes32 identifier.
     * @param seller Recipient of funds upon deliverable verification.
     * @param token ERC20 token address (or address(0) for native PISO gas currency).
     * @param amount Token quantity locked in escrow.
     * @param criteriaUri Prompt specification / task requirements string.
     * @param requiredQuorum Number of AI validator endorsements required for release.
     * @param deadline Unix timestamp for delivery expiration.
     */
    function createEscrow(
        bytes32 escrowId,
        address seller,
        address token,
        uint256 amount,
        string calldata criteriaUri,
        uint256 requiredQuorum,
        uint256 deadline
    ) external payable nonReentrant {
        if (seller == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (requiredQuorum == 0) revert QuorumNotAchievable();
        if (escrows[escrowId].status != EscrowStatus.Inactive) revert EscrowAlreadyClosed(escrowId);

        if (token == address(0)) {
            if (msg.value < amount) revert InsufficientStake(msg.value, amount);
        } else {
            bool success = IERC20(token).transferFrom(msg.sender, address(this), amount);
            if (!success) revert TransferFailed();
        }

        escrows[escrowId] = Escrow({
            escrowId: escrowId,
            buyer: msg.sender,
            seller: seller,
            token: token,
            amount: amount,
            criteriaUri: criteriaUri,
            deliverableUri: "",
            status: EscrowStatus.Funded,
            approvalVotes: 0,
            rejectionVotes: 0,
            requiredQuorum: requiredQuorum,
            createdAt: block.timestamp,
            deadline: deadline
        });

        emit EscrowCreated(
            escrowId,
            msg.sender,
            seller,
            token,
            amount,
            criteriaUri,
            requiredQuorum,
            deadline
        );
    }

    /**
     * @notice Seller submits deliverable proof (URL, hash, or IPFS URI).
     */
    function submitDeliverable(bytes32 escrowId, string calldata deliverableUri) external {
        Escrow storage esc = escrows[escrowId];
        if (esc.status != EscrowStatus.Funded) revert DeliverableNotSubmitted(escrowId);
        if (msg.sender != esc.seller && msg.sender != esc.buyer) revert UnauthorizedSessionKey(msg.sender);

        esc.deliverableUri = deliverableUri;
        esc.status = EscrowStatus.DeliverableSubmitted;

        emit DeliverableSubmitted(escrowId, deliverableUri);
    }

    // =========================================================================
    // 3. AUTONOMOUS AI VALIDATION (CALLED ONLY BY CLOUDFLARE SESSION KEY)
    // =========================================================================

    /**
     * @notice Submits AI evaluation attestation.
     * @dev Restricted strictly to the registered `cloudSessionKey`.
     *      No fund withdrawal logic exists in this function.
     * @param escrowId Escrow identifier.
     * @param approved True if AI verifier verified criteria fulfillment, false otherwise.
     * @param proofSignature Attestation signature or hash generated by edge validator.
     */
    function submitAIValidation(
        bytes32 escrowId,
        bool approved,
        bytes calldata proofSignature
    ) external nonReentrant {
        // 1. Verify caller is a valid, active session key
        ValidatorInfo storage val = validatorsBySessionKey[msg.sender];
        if (!val.isActive) revert UnauthorizedSessionKey(msg.sender);
        if (block.timestamp > val.sessionValidUntil) {
            revert SessionKeyExpired(val.sessionValidUntil, block.timestamp);
        }

        // 2. Validate escrow status
        Escrow storage esc = escrows[escrowId];
        if (esc.status != EscrowStatus.DeliverableSubmitted) revert DeliverableNotSubmitted(escrowId);
        if (hasVoted[escrowId][val.coldWallet]) revert ValidatorAlreadyVoted(escrowId, val.coldWallet);

        // 3. Mark vote to prevent double-voting
        hasVoted[escrowId][val.coldWallet] = true;
        val.totalValidations += 1;

        if (approved) {
            esc.approvalVotes += 1;
        } else {
            esc.rejectionVotes += 1;
        }

        emit AIValidationSubmitted(
            escrowId,
            val.coldWallet,
            msg.sender,
            approved,
            esc.approvalVotes,
            esc.requiredQuorum
        );

        // 4. Autonomous Clearing: Check Quorum fulfillment
        if (esc.approvalVotes >= esc.requiredQuorum) {
            esc.status = EscrowStatus.Released;
            _payout(esc.token, esc.seller, esc.amount);
            emit EscrowReleased(escrowId, esc.seller, esc.amount);
        } else if (esc.rejectionVotes >= esc.requiredQuorum) {
            esc.status = EscrowStatus.Refunded;
            _payout(esc.token, esc.buyer, esc.amount);
            emit EscrowRefunded(escrowId, esc.buyer, esc.amount);
        }
    }

    // --- INTERNAL HELPERS ---
    function _payout(address token, address recipient, uint256 amount) internal {
        if (token == address(0)) {
            (bool success, ) = recipient.call{value: amount}("");
            if (!success) revert TransferFailed();
        } else {
            bool success = IERC20(token).transfer(recipient, amount);
            if (!success) revert TransferFailed();
        }
    }

    // --- VIEWS ---
    function getEscrow(bytes32 escrowId) external view returns (Escrow memory) {
        return escrows[escrowId];
    }

    function isValidatorActive(address sessionKey) external view returns (bool) {
        ValidatorInfo memory val = validatorsBySessionKey[sessionKey];
        return val.isActive && (block.timestamp <= val.sessionValidUntil);
    }
}

