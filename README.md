# Paylinks

This project demonstrates a decentralized vault system using Ethereum smart contracts. Users can deposit ERC-20 tokens or ETH into the vault with a passphrase and an unlock time. The funds can be claimed by anyone with the correct passphrase after the unlock time.

## Getting Started

### Prerequisites

- Node.js (v14 or later)
- npm (v6 or later)
- Hardhat

### Set up environment variables:

Create a .env file in the root directory and add the following:

```shell
PRIVATE_KEY=your_private_key
CONTRACT_ADDRESS=your_contract_address
```

### Deployment

Compile the smart contracts using Hardhat:

```shell
npm install
npx hardhat compile
npx hardhat run scripts/deploy.js --network ink_sepolia
npx hardhat verify --network sepolia <DEPLOYED_CONTRACT_ADDRESS>
```

Supported Networks
- localhost
- ink_sepolia

### Testing

```shell
npx hardhat test
```