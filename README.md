# JOINADS COIN (JCOIN) Smart Contract

BEP-20 token for the JoinAds ecosystem on BNB Smart Chain.

## Features

- **Hard Cap**: 100,000,000 JCOIN (100M max supply)
- **Monthly Emission Cap**: 500,000 JCOIN per month
- **Role-based Access Control**: Separate ADMIN and MINTER roles
- **Pausable**: Emergency pause for all transfers
- **Transfer Restrictions**: Optional mint/burn only mode
- **Batch Minting**: Gas-efficient minting to multiple addresses
- **Burnable**: Token holders can burn their tokens

## Token Details

| Property | Value |
|----------|-------|
| Name | JOINADS COIN |
| Symbol | JCOIN |
| Decimals | 18 |
| Network | BNB Smart Chain (BSC) |
| Standard | BEP-20 (ERC-20 compatible) |

## Roles

| Role | Capabilities |
|------|-------------|
| DEFAULT_ADMIN_ROLE | Manage all roles |
| ADMIN_ROLE | Pause/unpause, set transfer restrictions |
| MINTER_ROLE | Mint tokens (respecting caps) |

## Quick Start

### Prerequisites

- Node.js >= 18.x
- npm or yarn

### Installation

```bash
cd jcoin-contract
npm install
```

### Compile

```bash
npx hardhat compile
```

### Run Tests

```bash
npx hardhat test
```

### Run Tests with Gas Report

```bash
REPORT_GAS=true npx hardhat test
```

## Deployment

### 1. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and add:
- `DEPLOYER_PRIVATE_KEY`: Your wallet private key
- `BSCSCAN_API_KEY`: For contract verification (get from [BSCScan](https://bscscan.com/apis))

### 2. Get Testnet BNB

Get test BNB from [BSC Testnet Faucet](https://testnet.bnbchain.org/faucet-smart)

### 3. Deploy to BSC Testnet

```bash
npx hardhat run scripts/deploy.js --network bscTestnet
```

### 4. Deploy to BSC Mainnet

⚠️ **CAUTION**: Real funds will be used!

```bash
npx hardhat run scripts/deploy.js --network bscMainnet
```

## Contract Functions

### Admin Functions

```solidity
// Pause all transfers
function pause() external onlyRole(ADMIN_ROLE)

// Resume transfers
function unpause() external onlyRole(ADMIN_ROLE)

// Enable/disable transfer restrictions (mint/burn only mode)
function setTransferRestrictions(bool restricted) external onlyRole(ADMIN_ROLE)
```

### Minting Functions

```solidity
// Mint to single address
function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE)

// Batch mint with different amounts
function batchMint(address[] recipients, uint256[] amounts) external onlyRole(MINTER_ROLE)

// Batch mint with equal amounts (more gas efficient)
function batchMintEqual(address[] recipients, uint256 amountEach) external onlyRole(MINTER_ROLE)
```

### Burning Functions

```solidity
// Burn your own tokens
function burn(uint256 amount) external

// Burn tokens from another address (requires approval)
function burnFrom(address account, uint256 amount) external
```

### View Functions

```solidity
// Remaining tokens that can be minted this month
function remainingMonthlyMint() external view returns (uint256)

// Remaining tokens until max supply
function remainingTotalMint() external view returns (uint256)

// Seconds until monthly cap resets
function timeUntilMonthReset() external view returns (uint256)
```

## Security Considerations

1. **Keep private keys safe**: Never commit `.env` to version control
2. **Multi-sig for mainnet**: Consider using a multi-sig wallet as admin
3. **Role management**: Carefully manage who has MINTER_ROLE
4. **Audit**: Get a professional audit before mainnet deployment

## Network Configuration

| Network | Chain ID | RPC URL |
|---------|----------|---------|
| BSC Testnet | 97 | https://data-seed-prebsc-1-s1.binance.org:8545 |
| BSC Mainnet | 56 | https://bsc-dataseed.binance.org/ |

## Gas Estimates

| Function | Estimated Gas |
|----------|---------------|
| mint | ~75,000 |
| batchMint (10 addresses) | ~250,000 |
| batchMintEqual (10 addresses) | ~230,000 |
| transfer | ~55,000 |
| burn | ~45,000 |

## Contract Verification

After deployment, the script automatically verifies on BSCScan. Manual verification:

```bash
npx hardhat verify --network bscTestnet <CONTRACT_ADDRESS> <ADMIN_ADDRESS>
```

## License

MIT
