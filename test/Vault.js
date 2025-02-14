const { time, loadFixture, keccak256, toUtf8Bytes } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");

describe("PassphraseVault", function () {
  let Vault, vault, owner, depositor, recipient, attacker, token;
  const passphrase = "securepassword";
  const wrongPassphrase = "wrongpassword";

  beforeEach(async function () {
    [owner, depositor, recipient, attacker] = await ethers.getSigners();

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
    const deposit = await vault.getDepositorDeposits(await depositor.getAddress());
    console.log("User Deposit : ", deposit);
    expect(deposit[0]).is.not.null;
  });

  it("should allow claim and reveal process", async function () {
    const amount = ethers.parseEther("10");
    const unlockTime = (await time.latest()) + 3600; // 1 hour from now

    await vault.connect(depositor).deposit(this.tokenAddress, amount, passphrase, unlockTime);
    const deposit = await vault.getDepositorDeposits(await depositor.getAddress());
    console.log("User Deposit : ", deposit);

    await time.increaseTo(unlockTime + 1);

    // Step 1: Submit claim hash
    const claimHash = ethers.keccak256(
      ethers.concat([
        ethers.toUtf8Bytes(passphrase), 
        ethers.getBytes(await recipient.getAddress())
      ])
    );

    console.log("Generated Claim Hash : ", claimHash);

    await vault.connect(recipient).claim(deposit[0], claimHash);

    // Step 2: Reveal the claim
    const recipientBalanceBefore = await token.balanceOf(await recipient.getAddress());
    await vault.connect(recipient).revealClaim(deposit[0], passphrase, await recipient.getAddress());
    const recipientBalanceAfter = await token.balanceOf(await recipient.getAddress());
    console.log("Recipient Balance Changes : ", recipientBalanceBefore, recipientBalanceAfter);

    expect(recipientBalanceAfter).to.be.greaterThan(recipientBalanceBefore);
  });


  it("should NOT allow claim with wrong passphrase", async function () {
    const amount = ethers.parseEther("10");
    const unlockTime = (await time.latest()) + 3600; // 1 hour from now
    const badPassphrase = "badpassword";

    await vault.connect(depositor).deposit(this.tokenAddress, amount, passphrase, unlockTime);
    const deposit = await vault.getDepositorDeposits(await depositor.getAddress());
    console.log("User Deposit : ", deposit);

    await time.increaseTo(unlockTime + 1);

    // Step 1: Submit claim hash with bad passphrase
    const claimHash = ethers.keccak256(
      ethers.concat([
        ethers.toUtf8Bytes(badPassphrase), 
        ethers.getBytes(await recipient.getAddress())
      ])
    );

    console.log("Generated Claim Hash : ", claimHash);

    await vault.connect(recipient).claim(deposit[0], claimHash);

    // Step 2: Reveal the claim and fail
    await expect(vault.connect(recipient).revealClaim(deposit[0], badPassphrase, recipient.getAddress()))
    .to.be.revertedWith("Invalid passphrase");
  });


  it("should NOT allow reveal with wrong destination", async function () {
    const amount = ethers.parseEther("10");
    const unlockTime = (await time.latest()) + 3600; // 1 hour from now
    const badPassphrase = "badpassword";

    await vault.connect(depositor).deposit(this.tokenAddress, amount, passphrase, unlockTime);
    const deposit = await vault.getDepositorDeposits(await depositor.getAddress());
    console.log("User Deposit : ", deposit);

    await time.increaseTo(unlockTime + 1);

    // Step 1: Submit claim hash with bad passphrase
    const claimHash = ethers.keccak256(
      ethers.concat([
        ethers.toUtf8Bytes(passphrase), 
        ethers.getBytes(await recipient.getAddress())
      ])
    );

    console.log("Generated Good Claim Hash : ", claimHash);

    await vault.connect(recipient).claim(deposit[0], claimHash);

    // Step 2: Reveal the claim with bad address and fail
    await expect(vault.connect(attacker).revealClaim(deposit[0], passphrase, attacker.getAddress()))
    .to.be.revertedWith("Invalid reveal");
  });


  it("attacker front run fails, deposit goes to intended user", async function () {
    const amount = ethers.parseEther("10");
    const unlockTime = (await time.latest()) + 3600; // 1 hour from now
    const badPassphrase = "badpassword";

    await vault.connect(depositor).deposit(this.tokenAddress, amount, passphrase, unlockTime);
    const deposit = await vault.getDepositorDeposits(await depositor.getAddress());
    console.log("User Deposit : ", deposit);

    await time.increaseTo(unlockTime + 1);

    // Step 1: Submit claim hash with bad passphrase
    const claimHash = ethers.keccak256(
      ethers.concat([
        ethers.toUtf8Bytes(passphrase), 
        ethers.getBytes(await recipient.getAddress())
      ])
    );

    console.log("Generated Good Claim Hash : ", claimHash);

    await vault.connect(recipient).claim(deposit[0], claimHash);

    // Step 2: Attacker front runs the claim
    const recipientBalanceBefore = await token.balanceOf(await recipient.getAddress());
    await vault.connect(attacker).revealClaim(deposit[0], passphrase, recipient.getAddress());

    const recipientBalanceAfter = await token.balanceOf(await recipient.getAddress());
    console.log("Recipient Balance Changes : ", recipientBalanceBefore, recipientBalanceAfter);

    expect(recipientBalanceAfter).to.be.greaterThan(recipientBalanceBefore);
  });

  it("should allow depositor to refund before claim", async function () {
    const amount = ethers.parseEther("10");
    const unlockTime = (await time.latest()) + 3600;

    await vault.connect(depositor).deposit(this.tokenAddress, amount, passphrase, unlockTime);
    const deposit = await vault.getDepositorDeposits(await depositor.getAddress());
    console.log("User Deposit : ", deposit);

    const depositorBalanceBefore = await token.balanceOf(await depositor.getAddress());

    await vault.connect(depositor).refund(deposit[0]);

    const depositorBalanceAfter = await token.balanceOf(await depositor.getAddress());
    console.log("Depositor Balance Changes : ", depositorBalanceBefore, depositorBalanceAfter);

    expect(depositorBalanceAfter).to.be.greaterThan(depositorBalanceBefore);
  });

  it("should NOT allow refund after a claim is submitted", async function () {
    const amount = ethers.parseEther("10");
    const unlockTime = (await time.latest()) + 3600;

    await vault.connect(depositor).deposit(this.tokenAddress, amount, passphrase, unlockTime);
    const deposit = await vault.getDepositorDeposits(await depositor.getAddress());
    console.log("User Deposit : ", deposit);

    await time.increaseTo(unlockTime + 1);

    // Step 1: Submit claim hash with bad passphrase
    const claimHash = ethers.keccak256(
      ethers.concat([
        ethers.toUtf8Bytes(passphrase), 
        ethers.getBytes(await recipient.getAddress())
      ])
    );

    console.log("Generated Good Claim Hash : ", claimHash);

    await vault.connect(recipient).claim(deposit[0], claimHash);

    await vault.connect(depositor).refund(deposit[0]);

    // Step 2: Try to refund after claim was submitted
    await expect(vault.connect(depositor).refund(deposit[0]))
      .to.be.revertedWith("No tokens to refund");
  });

  it("should NOT allow an unauthorized user to refund", async function () {
    const amount = ethers.parseEther("10");
    const unlockTime = (await time.latest()) + 3600;

    await vault.connect(depositor).deposit(this.tokenAddress, amount, passphrase, unlockTime);

    const deposit = await vault.getDepositorDeposits(await depositor.getAddress());

    await expect(vault.connect(attacker).refund(deposit[0])).to.be.revertedWith("Not authorized");
  });
});
