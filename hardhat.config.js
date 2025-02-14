require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.28",
  networks: {
    inksepolia: {
      url: process.env.INK_SEPOLIA_URL || "",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
    ink: {
      url: process.env.INK_URL || "",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },
  etherscan: {
    apiKey: {
      inksepolia: process.env.BLOCKSCOUT_API_KEY,
      ink: process.env.BLOCKSCOUT_API_KEY,
    },
    customChains: [
      {
        network: "inksepolia",
        chainId: 763373,
        urls: {
          apiURL: "https://explorer-sepolia.inkonchain.com/api",
          browserURL: "https://explorer-sepolia.inkonchain.com/",
        },
      },
      {
        network: "ink",
        chainId: 57073,
        urls: {
          apiURL: "https://explorer.inkonchain.com/api",
          browserURL: "https://explorer.inkonchain.com/",
        },
      },
    ],
  },
};