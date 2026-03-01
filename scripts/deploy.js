const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  
  console.log("Deploying JoinAdsCoin with account:", deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "BNB");

  const JoinAdsCoin = await hre.ethers.getContractFactory("JoinAdsCoin");
  const jcoin = await JoinAdsCoin.deploy(deployer.address);
  
  await jcoin.waitForDeployment();
  const address = await jcoin.getAddress();

  console.log("\n✅ JoinAdsCoin deployed successfully!");
  console.log("Contract address:", address);
  console.log("Token name:", await jcoin.name());
  console.log("Token symbol:", await jcoin.symbol());
  console.log("Max supply:", hre.ethers.formatEther(await jcoin.MAX_SUPPLY()), "JCOIN");
  console.log("Monthly cap:", hre.ethers.formatEther(await jcoin.MONTHLY_CAP()), "JCOIN");

  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    console.log("\nWaiting for block confirmations...");
    await jcoin.deploymentTransaction().wait(5);

    console.log("Verifying contract on BSCScan...");
    try {
      await hre.run("verify:verify", {
        address: address,
        constructorArguments: [deployer.address],
      });
      console.log("✅ Contract verified on BSCScan!");
    } catch (error) {
      console.log("❌ Verification failed:", error.message);
    }
  }

  console.log("\n📋 Deployment Summary:");
  console.log("========================");
  console.log(`Network: ${hre.network.name}`);
  console.log(`Contract: ${address}`);
  console.log(`Admin: ${deployer.address}`);
  console.log(`Block: ${await hre.ethers.provider.getBlockNumber()}`);
  
  const deploymentInfo = {
    network: hre.network.name,
    contractAddress: address,
    adminAddress: deployer.address,
    deployedAt: new Date().toISOString(),
    txHash: jcoin.deploymentTransaction().hash,
  };
  
  if (!fs.existsSync("deployments")) {
    fs.mkdirSync("deployments");
  }
  
  fs.writeFileSync(
    `deployments/${hre.network.name}.json`,
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log(`\n📁 Deployment info saved to deployments/${hre.network.name}.json`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
