// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title JoinAdsCoin (JCOIN)
 * @dev BEP-20 token for the JoinAds ecosystem on BNB Smart Chain
 * 
 * Features:
 * - Hard cap: 100,000,000 JCOIN
 * - Monthly emission cap: 500,000 JCOIN
 * - Role-based access (ADMIN, MINTER)
 * - Pausable transfers
 * - Optional transfer restrictions (mint/burn only mode)
 * - Batch minting for gas efficiency
 */
contract JoinAdsCoin is ERC20, ERC20Burnable, AccessControl, Pausable {
    // ============ Constants ============
    uint256 public constant MAX_SUPPLY = 100_000_000 * 10**18; // 100M tokens
    uint256 public constant MONTHLY_CAP = 500_000 * 10**18;    // 500K tokens/month
    uint256 public constant MONTH_DURATION = 30 days;

    // ============ Roles ============
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    // ============ State Variables ============
    uint256 public currentMonthStart;
    uint256 public mintedThisMonth;
    bool public transfersRestricted;

    // ============ Events ============
    event TransferRestrictionsUpdated(bool restricted);
    event MonthlyCapReset(uint256 newMonthStart);
    event BatchMint(address indexed minter, uint256 totalAmount, uint256 recipientCount);

    // ============ Errors ============
    error ExceedsMaxSupply(uint256 requested, uint256 available);
    error ExceedsMonthlyCap(uint256 requested, uint256 available);
    error TransfersRestricted();
    error ArrayLengthMismatch();
    error ZeroAddress();
    error ZeroAmount();

    // ============ Constructor ============
    constructor(address admin) ERC20("JOINADS COIN", "JCOIN") {
        if (admin == address(0)) revert ZeroAddress();
        
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
        
        currentMonthStart = block.timestamp;
    }

    // ============ Admin Functions ============

    /**
     * @dev Pause all token transfers
     */
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    /**
     * @dev Unpause token transfers
     */
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    /**
     * @dev Enable or disable transfer restrictions
     * When restricted, only mint and burn operations are allowed
     */
    function setTransferRestrictions(bool restricted) external onlyRole(ADMIN_ROLE) {
        transfersRestricted = restricted;
        emit TransferRestrictionsUpdated(restricted);
    }

    // ============ Minting Functions ============

    /**
     * @dev Mint tokens to a single address
     * @param to Recipient address
     * @param amount Amount of tokens to mint (in wei)
     */
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        _mintWithChecks(to, amount);
    }

    /**
     * @dev Batch mint tokens to multiple addresses
     * Gas efficient: single storage update for monthly cap
     * @param recipients Array of recipient addresses
     * @param amounts Array of amounts to mint (in wei)
     */
    function batchMint(
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external onlyRole(MINTER_ROLE) {
        if (recipients.length != amounts.length) revert ArrayLengthMismatch();
        
        uint256 totalAmount = 0;
        uint256 len = recipients.length;
        
        // Calculate total and validate
        for (uint256 i = 0; i < len; ) {
            if (recipients[i] == address(0)) revert ZeroAddress();
            if (amounts[i] == 0) revert ZeroAmount();
            totalAmount += amounts[i];
            unchecked { ++i; }
        }
        
        // Check caps once for the total
        _checkAndUpdateCaps(totalAmount);
        
        // Perform mints
        for (uint256 i = 0; i < len; ) {
            _mint(recipients[i], amounts[i]);
            unchecked { ++i; }
        }
        
        emit BatchMint(msg.sender, totalAmount, len);
    }

    /**
     * @dev Batch mint equal amounts to multiple addresses
     * More gas efficient when all recipients get the same amount
     * @param recipients Array of recipient addresses
     * @param amountEach Amount to mint to each recipient (in wei)
     */
    function batchMintEqual(
        address[] calldata recipients,
        uint256 amountEach
    ) external onlyRole(MINTER_ROLE) {
        if (amountEach == 0) revert ZeroAmount();
        
        uint256 len = recipients.length;
        uint256 totalAmount = amountEach * len;
        
        // Check caps once for the total
        _checkAndUpdateCaps(totalAmount);
        
        // Perform mints
        for (uint256 i = 0; i < len; ) {
            if (recipients[i] == address(0)) revert ZeroAddress();
            _mint(recipients[i], amountEach);
            unchecked { ++i; }
        }
        
        emit BatchMint(msg.sender, totalAmount, len);
    }

    // ============ View Functions ============

    /**
     * @dev Returns the amount that can still be minted this month
     */
    function remainingMonthlyMint() external view returns (uint256) {
        if (block.timestamp >= currentMonthStart + MONTH_DURATION) {
            return MONTHLY_CAP;
        }
        return MONTHLY_CAP > mintedThisMonth ? MONTHLY_CAP - mintedThisMonth : 0;
    }

    /**
     * @dev Returns the total amount that can still be minted (respecting max supply)
     */
    function remainingTotalMint() external view returns (uint256) {
        return MAX_SUPPLY - totalSupply();
    }

    /**
     * @dev Returns seconds until the monthly cap resets
     */
    function timeUntilMonthReset() external view returns (uint256) {
        uint256 monthEnd = currentMonthStart + MONTH_DURATION;
        if (block.timestamp >= monthEnd) return 0;
        return monthEnd - block.timestamp;
    }

    // ============ Internal Functions ============

    /**
     * @dev Internal mint with all cap checks
     */
    function _mintWithChecks(address to, uint256 amount) internal {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        
        _checkAndUpdateCaps(amount);
        _mint(to, amount);
    }

    /**
     * @dev Check and update monthly and total supply caps
     */
    function _checkAndUpdateCaps(uint256 amount) internal {
        // Check max supply
        uint256 newSupply = totalSupply() + amount;
        if (newSupply > MAX_SUPPLY) {
            revert ExceedsMaxSupply(amount, MAX_SUPPLY - totalSupply());
        }
        
        // Reset monthly cap if new month
        if (block.timestamp >= currentMonthStart + MONTH_DURATION) {
            currentMonthStart = block.timestamp;
            mintedThisMonth = 0;
            emit MonthlyCapReset(currentMonthStart);
        }
        
        // Check monthly cap
        uint256 newMonthlyMint = mintedThisMonth + amount;
        if (newMonthlyMint > MONTHLY_CAP) {
            revert ExceedsMonthlyCap(amount, MONTHLY_CAP - mintedThisMonth);
        }
        
        mintedThisMonth = newMonthlyMint;
    }

    /**
     * @dev Override _update to implement pause and transfer restrictions
     */
    function _update(
        address from,
        address to,
        uint256 value
    ) internal virtual override {
        // Check if paused (for all operations)
        if (paused()) {
            require(from == address(0) || to == address(0), "Pausable: paused");
        }
        
        // Check transfer restrictions (skip for mint/burn)
        if (transfersRestricted) {
            if (from != address(0) && to != address(0)) {
                revert TransfersRestricted();
            }
        }
        
        super._update(from, to, value);
    }

    /**
     * @dev Override supportsInterface for AccessControl
     */
    function supportsInterface(bytes4 interfaceId) 
        public 
        view 
        virtual 
        override(AccessControl) 
        returns (bool) 
    {
        return super.supportsInterface(interfaceId);
    }
}
