const { time, loadFixture, keccak256, toUtf8Bytes } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");

describe("PassphraseVault", function () {
  let Vault, vault, owner, depositor, collector, attacker, token;
  const passphrase = "securepassword";
  const wrongPassphrase = "wrongpassword";
  let passphraseHash, depositId;

  beforeEach(async function () {
    [owner, depositor, collector, attacker] = await ethers.getSigners();

    // Deploy a mock ERC20 token
    const Token = await ethers.getContractFactory("MockToken");
    token = await Token.deploy();
    await token.waitForDeployment();
    this.tokenAddress = await token.getAddress();

    // Deploy the Vault
    Vault = await ethers.getContractFactory("PassphraseVault");
    vault = await Vault.deploy();
    await vault.waitForDeployment();
    this.vaultAddress = await vault.getAddress();

    // Mint tokens for depositor
    await token.connect(owner).mint(depositor.address, ethers.parseEther("100"));
    await token.connect(depositor).approve(this.vaultAddress, ethers.parseEther("100"));
  });

  it("should allow ERC20 deposit", async function () {
    const amount = ethers.parseEther("10");
    const unlockTime = (await time.latest()) + 3600; // 1 hour from now

    await vault.connect(depositor).deposit(this.tokenAddress, amount, passphrase, unlockTime);

    const depositId = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "address", "uint256", "bytes32", "uint256"], // Ensure correct order
        [
          await depositor.getAddress(), 
          this.tokenAddress, 
          amount, 
          ethers.keccak256(ethers.toUtf8Bytes(passphrase)),
          unlockTime
        ]
      )
    );
    
    const deposit = await vault.getDepositorDeposits(await depositor.getAddress());
    console.log(`Depositor: ${await depositor.getAddress()}, Deposit ID: ${deposit[0]}`);
    expect(deposit[0]).is.not.null
  });

  it("should allow claim after unlock time with correct passphrase", async function () {
    const amount = ethers.parseEther("10");
    const unlockTime = (await time.latest()) + 3600; // 1 hour from now

    await vault.connect(depositor).deposit(this.tokenAddress, amount, passphrase, unlockTime);

    const depositId = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "address", "uint256", "bytes32", "uint256"], // Ensure correct order
        [
          await depositor.getAddress(), 
          this.tokenAddress, 
          amount, 
          ethers.keccak256(ethers.toUtf8Bytes(passphrase)),
          unlockTime
        ]
      )
    );

    await time.increaseTo(unlockTime + 3601);

    const deposit = await vault.getDepositorDeposits(await depositor.getAddress());
    console.log("Recovering deposit: ", deposit[0]);

    const collectorBalanceBefore = await token.balanceOf(collector.getAddress());
    console.log(`Collector balance before claim: ${collectorBalanceBefore.toString()}`);

    await vault.connect(collector).claim(deposit[0], passphrase);

    const collectorBalanceAfter = await token.balanceOf(collector.getAddress());
    console.log(`Collector balance after claim: ${collectorBalanceAfter.toString()}`);

    expect(collectorBalanceAfter).to.greaterThan(collectorBalanceBefore);
  });

  it("should allow claim after unlock time with a valid signature", async function () {
    const amount = ethers.parseEther("10");
    const unlockTime = (await time.latest()) + 3600; // 1 hour from now

    await vault.connect(depositor).deposit(this.tokenAddress, amount, passphrase, unlockTime);
    const deposit = await vault.getDepositorDeposits(await depositor.getAddress());
    console.log("Deposit Recieved: ", deposit[0]);

    await time.increaseTo(unlockTime + 1);

    // Sign the depositId off-chain
    const signature = await depositor.signMessage(ethers.getBytes(deposit[0]));
    const sig = ethers.Signature.from(signature);
    console.log("Collecting with signature: ", sig);
    console.log("Signature v:", sig.v);  // This should be either 27 or 28
    console.log("Signature r:", sig.r);
    console.log("Signature s:", sig.s);
    console.log("Depositor Address: ",await depositor.getAddress());

    const recoveredAddress = ethers.recoverAddress(ethers.getBytes(deposit[0]), signature);
    console.log("Recovered Address:", recoveredAddress);

    // Collector claims with the depositor's signature
    const collectorBalanceBefore = await token.balanceOf(await collector.getAddress());
    console.log(`Collector balance before claim: ${collectorBalanceBefore.toString()}`);

    await vault.connect(collector).claimWithSignature(deposit[0], sig.v, sig.r, sig.s);

    const collectorBalanceAfter = await token.balanceOf(collector.address);
    console.log(`Collector balance after claim: ${collectorBalanceAfter.toString()}`);

    // Ensure collector's balance increased
    expect(collectorBalanceAfter).to.be.greaterThan(collectorBalanceBefore);
  });


  it("should NOT allow claim with incorrect passphrase", async function () {
    const amount = ethers.parseEther("10");
    const unlockTime = (await time.latest()) + 3600; // 1 hour from now
    const wrongPassphrase = "wrongpassword";

    await vault.connect(depositor).deposit(this.tokenAddress, amount, passphrase, unlockTime);

    const depositId = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "address", "uint256", "bytes32", "uint256"], // Ensure correct order
        [
          await depositor.getAddress(), 
          this.tokenAddress, 
          amount, 
          ethers.keccak256(ethers.toUtf8Bytes(passphrase)),
          unlockTime
        ]
      )
    );
    console.log(depositId);

    await time.increaseTo(unlockTime + 3601);

    const deposit = await vault.getDepositorDeposits(await depositor.getAddress());
    console.log("Claiming depositID: ", deposit[0]);

    const collectorBalanceBefore = await token.balanceOf(collector.getAddress());
    console.log(`Collector balance before claim: ${collectorBalanceBefore.toString()}`);

    await expect(vault.connect(collector).claim(deposit[0], wrongPassphrase)).to.be.revertedWith("Invalid passphrase");
  });

  it("should allow depositor to recover ", async function () {
    const amount = ethers.parseEther("10");
    const unlockTime = (await time.latest()) + 3600; // 1 hour from now

    await vault.connect(depositor).deposit(this.tokenAddress, amount, passphrase, unlockTime);

    const deposit = await vault.getDepositorDeposits(await depositor.getAddress());
    console.log("Recovering deposit: ", deposit[0]);

    const depositorBalanceBefore = await token.balanceOf(await depositor.getAddress());
    console.log(`Collector balance before claim: ${depositorBalanceBefore.toString()}`);

    await vault.connect(depositor).refund(deposit[0]);

    const depositorBalanceAfter = await token.balanceOf(depositor.getAddress());
    console.log(`Collector balance after claim: ${depositorBalanceAfter.toString()}`);

    expect(depositorBalanceAfter).to.greaterThan(depositorBalanceBefore);

  });

  it("should NOT allow anyone to recover ", async function () {
    const amount = ethers.parseEther("10");
    const unlockTime = (await time.latest()) + 3600; // 1 hour from now

    await vault.connect(depositor).deposit(this.tokenAddress, amount, passphrase, unlockTime);

    const deposit = await vault.getDepositorDeposits(await depositor.getAddress());
    console.log("Recovering deposit: ", deposit[0]);

    const collectorBalanceBefore = await token.balanceOf(await collector.getAddress());
    console.log(`Collector balance before claim: ${collectorBalanceBefore.toString()}`);

    const collectorBalanceAfter = await token.balanceOf(collector.getAddress());
    console.log(`Collector balance after claim: ${collectorBalanceAfter.toString()}`);

    await expect(vault.connect(collector).refund(deposit[0])).to.be.revertedWith("Not authorized");

  });
});
