require('dotenv').config();
const { ethers } = require('ethers');
const yargs = require('yargs');

const encode = (depositID, passphrase) => {
  const data = depositID + "|" + passphrase;
  const base64Encoded = ethers.encodeBase64(ethers.toUtf8Bytes(data));
  const base64UrlEncoded = base64Encoded
    .replace(/\+/g, "-")  // Replace + with -
    .replace(/\//g, "_")  // Replace / with _
    .replace(/=+$/, "");  // Remove trailing =
  return base64UrlEncoded;
};

const decode = (encoded) => {
  const base64Encoded = encoded
    .replace(/-/g, "+")  // Replace - with +
    .replace(/_/g, "/"); // Replace _ with /
  const decodedBytes = ethers.decodeBase64(base64Encoded);
  const decodedString = ethers.toUtf8String(decodedBytes);
  const [depositID, passphrase] = decodedString.split("|");
  return { depositID, passphrase };
};

yargs.command({
  command: 'encode',
  describe: 'Encode deposit ID and passphrase',
  builder: {
    depositID: {
      describe: 'Deposit ID',
      demandOption: true,
      type: 'string',
    },
    passphrase: {
      describe: 'Passphrase',
      demandOption: true,
      type: 'string',
    },
  },
  handler: (argv) => {
    const encoded = encode(argv.depositID, argv.passphrase);
    console.log("Encoded URL-safe Base64:", encoded);
  },
});

yargs.command({
  command: 'decode',
  describe: 'Decode the encoded string',
  builder: {
    encoded: {
      describe: 'Encoded string',
      demandOption: true,
      type: 'string',
    },
  },
  handler: (argv) => {
    const { depositID, passphrase } = decode(argv.encoded);
    console.log("Decoded Deposit ID:", depositID);
    console.log("Decoded Passphrase:", passphrase);
  },
});

yargs.parse();