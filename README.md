# Sample Hardhat Project

This project demonstrates a basic Hardhat use case. It comes with a sample contract, a test for that contract, and a Hardhat Ignition module that deploys that contract.

Try running some of the following tasks:

```shell
npx hardhat help
npx hardhat test
REPORT_GAS=true npx hardhat test
npx hardhat node
npx hardhat ignition deploy ./ignition/modules/Lock.js
```

npx hardhat run scripts/deploy-and-verify.js --network inksepolia
npx hardhat verify --network inksepolia 0x320170Be6bd7A649387D4296C90E49Cf2BB26bd1