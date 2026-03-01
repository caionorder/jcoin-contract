const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const jcoin = await hre.ethers.getContractAt("JoinAdsCoin", "0x6D48cfc545f9Cc97676ffA2728720B908B86Cc6A");
  
  const monthlyCap = await jcoin.MONTHLY_CAP();
  console.log("Monthly cap:", hre.ethers.formatEther(monthlyCap), "JCOIN");
  console.log("Current supply:", hre.ethers.formatEther(await jcoin.totalSupply()), "JCOIN");
  
  console.log("\nMinting 500,000 JCOIN to", deployer.address, "...");
  const tx = await jcoin.mint(deployer.address, monthlyCap);
  await tx.wait();
  
  console.log("✅ Mint successful! Tx:", tx.hash);
  console.log("New supply:", hre.ethers.formatEther(await jcoin.totalSupply()), "JCOIN");
  console.log("Balance:", hre.ethers.formatEther(await jcoin.balanceOf(deployer.address)), "JCOIN");
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
