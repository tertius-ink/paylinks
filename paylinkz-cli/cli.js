// filepath: /Users/tertius/Projects/paylinkz-cli/cli.js
require('dotenv').config();
const { ethers } = require('ethers');
const yargs = require('yargs');
const PassphraseVault = require('./PassphraseVault.json'); // Your contract ABI

const provider = new ethers.providers.InfuraProvider('sepolia', process.env.INFURA_API_KEY);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, PassphraseVault.abi, wallet);

yargs.command({
  command: 'deposit',
  describe: 'Deposit funds to the vault',
  builder: {
    amount: {
      describe: 'Amount to deposit in ETH',
      demandOption: true,
      type: 'string',
    },
    passphrase: {
      describe: 'Passphrase for the deposit',
      demandOption: true,
      type: 'string',
    },
    unlockTime: {
      describe: 'Unlock time (in seconds since epoch)',
      demandOption: true,
      type: 'number',
    },
  },
  handler: async (argv) => {
    const amountInWei = ethers.utils.parseEther(argv.amount);
    const tx = await contract.depositETH(argv.passphrase, argv.unlockTime, { value: amountInWei });
    await tx.wait();
    console.log('Deposit successful');
  },
});

yargs.command({
  command: 'claim',
  describe: 'Claim funds from the vault',
  builder: {
    depositId: {
      describe: 'Deposit ID',
      demandOption: true,
      type: 'string',
    },
    passphrase: {
      describe: 'Passphrase for the deposit',
      demandOption: true,
      type: 'string',
    },
  },
  handler: async (argv) => {
    const tx = await contract.claim(argv.depositId, argv.passphrase);
    await tx.wait();
    console.log('Claim successful');
  },
});

yargs.command({
  command: 'refund',
  describe: 'Refund funds from the vault',
  builder: {
    depositId: {
      describe: 'Deposit ID',
      demandOption: true,
      type: 'string',
    },
  },
  handler: async (argv) => {
    const tx = await contract.refund(argv.depositId);
    await tx.wait();
    console.log('Refund successful');
  },
});

yargs.parse();