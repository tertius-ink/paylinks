require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const { INFURA_API_KEY, PRIVATE_KEY } = process.env;

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.28",
  networks: {
    ink_sepolia: {
      url: `https://rpc-gel-sepolia.inkonchain.com`,
      accounts: [PRIVATE_KEY],
    },
    localhost: {
      url: "http://127.0.0.1:8545",
    },
  },
};