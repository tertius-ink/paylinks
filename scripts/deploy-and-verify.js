async function main() {
  console.log("Deploying contracts...");

  // Deploy MockToken
  const MockToken = await ethers.getContractFactory("MockToken");
  const mockToken = await MockToken.deploy();
  await mockToken.waitForDeployment();
  const mockTokenAddress = await mockToken.getAddress();
  console.log("MockToken deployed to:", mockTokenAddress);

  // Deploy PassphraseVault
  const PassphraseVault = await ethers.getContractFactory("PassphraseVault");
  const vault = await PassphraseVault.deploy();
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log("PassphraseVault deployed to:", vaultAddress);

  // Wait for block confirmations
  console.log("Waiting for block confirmations...");
  await mockToken.deploymentTransaction().wait(5);
  await vault.deploymentTransaction().wait(5);

  // Verify contracts
  console.log("Starting verification process...");

  try {
    console.log("Verifying MockToken...");
    await hre.run("verify:verify", {
      address: mockTokenAddress,
      contract: "contracts/MockToken.sol:MockToken",
      constructorArguments: []
    });
  } catch (error) {
    console.log("MockToken verification failed:", error);
  }

  try {
    console.log("Verifying PassphraseVault...");
    await hre.run("verify:verify", {
      address: vaultAddress,
      contract: "contracts/Vault.sol:PassphraseVault",
      constructorArguments: []
    });
  } catch (error) {
    console.log("PassphraseVault verification failed:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
