const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("JoinAdsCoin", function () {
  let jcoin;
  let owner;
  let minter;
  let user1;
  let user2;
  let users;

  const ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ADMIN_ROLE"));
  const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
  const DEFAULT_ADMIN_ROLE = ethers.ZeroHash;

  const MAX_SUPPLY = ethers.parseEther("100000000"); // 100M
  const MONTHLY_CAP = ethers.parseEther("500000");   // 500K
  const MONTH_DURATION = 30 * 24 * 60 * 60;          // 30 days in seconds

  beforeEach(async function () {
    [owner, minter, user1, user2, ...users] = await ethers.getSigners();

    const JoinAdsCoin = await ethers.getContractFactory("JoinAdsCoin");
    jcoin = await JoinAdsCoin.deploy(owner.address);
    await jcoin.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the correct name and symbol", async function () {
      expect(await jcoin.name()).to.equal("JOINADS COIN");
      expect(await jcoin.symbol()).to.equal("JCOIN");
    });

    it("Should have 18 decimals", async function () {
      expect(await jcoin.decimals()).to.equal(18);
    });

    it("Should start with 0 total supply", async function () {
      expect(await jcoin.totalSupply()).to.equal(0);
    });

    it("Should grant all roles to admin", async function () {
      expect(await jcoin.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
      expect(await jcoin.hasRole(ADMIN_ROLE, owner.address)).to.be.true;
      expect(await jcoin.hasRole(MINTER_ROLE, owner.address)).to.be.true;
    });

    it("Should set correct constants", async function () {
      expect(await jcoin.MAX_SUPPLY()).to.equal(MAX_SUPPLY);
      expect(await jcoin.MONTHLY_CAP()).to.equal(MONTHLY_CAP);
      expect(await jcoin.MONTH_DURATION()).to.equal(MONTH_DURATION);
    });

    it("Should revert if admin is zero address", async function () {
      const JoinAdsCoin = await ethers.getContractFactory("JoinAdsCoin");
      await expect(JoinAdsCoin.deploy(ethers.ZeroAddress))
        .to.be.revertedWithCustomError(jcoin, "ZeroAddress");
    });
  });

  describe("Role Management", function () {
    it("Should allow DEFAULT_ADMIN to grant MINTER_ROLE", async function () {
      await jcoin.grantRole(MINTER_ROLE, minter.address);
      expect(await jcoin.hasRole(MINTER_ROLE, minter.address)).to.be.true;
    });

    it("Should allow DEFAULT_ADMIN to revoke MINTER_ROLE", async function () {
      await jcoin.grantRole(MINTER_ROLE, minter.address);
      await jcoin.revokeRole(MINTER_ROLE, minter.address);
      expect(await jcoin.hasRole(MINTER_ROLE, minter.address)).to.be.false;
    });

    it("Should not allow non-admin to grant roles", async function () {
      await expect(
        jcoin.connect(user1).grantRole(MINTER_ROLE, user1.address)
      ).to.be.reverted;
    });
  });

  describe("Minting", function () {
    it("Should allow MINTER_ROLE to mint tokens", async function () {
      const amount = ethers.parseEther("1000");
      await jcoin.mint(user1.address, amount);
      expect(await jcoin.balanceOf(user1.address)).to.equal(amount);
    });

    it("Should not allow non-minter to mint", async function () {
      const amount = ethers.parseEther("1000");
      await expect(
        jcoin.connect(user1).mint(user1.address, amount)
      ).to.be.reverted;
    });

    it("Should track monthly minted amount", async function () {
      const amount = ethers.parseEther("1000");
      await jcoin.mint(user1.address, amount);
      expect(await jcoin.mintedThisMonth()).to.equal(amount);
    });

    it("Should revert when exceeding monthly cap", async function () {
      const amount = MONTHLY_CAP + ethers.parseEther("1");
      await expect(jcoin.mint(user1.address, amount))
        .to.be.revertedWithCustomError(jcoin, "ExceedsMonthlyCap");
    });

    it("Should revert when exceeding max supply", async function () {
      const JoinAdsCoin = await ethers.getContractFactory("JoinAdsCoin");
      const testCoin = await JoinAdsCoin.deploy(owner.address);
      
      const overMax = MAX_SUPPLY + ethers.parseEther("1");
      await expect(testCoin.mint(user1.address, overMax))
        .to.be.revertedWithCustomError(testCoin, "ExceedsMaxSupply");
    });

    it("Should reset monthly cap after 30 days", async function () {
      await jcoin.mint(user1.address, MONTHLY_CAP);
      
      await expect(jcoin.mint(user1.address, ethers.parseEther("1")))
        .to.be.revertedWithCustomError(jcoin, "ExceedsMonthlyCap");
      
      await time.increase(MONTH_DURATION);
      
      const amount = ethers.parseEther("1000");
      await jcoin.mint(user1.address, amount);
      expect(await jcoin.mintedThisMonth()).to.equal(amount);
    });

    it("Should revert on zero address mint", async function () {
      await expect(jcoin.mint(ethers.ZeroAddress, ethers.parseEther("100")))
        .to.be.revertedWithCustomError(jcoin, "ZeroAddress");
    });

    it("Should revert on zero amount mint", async function () {
      await expect(jcoin.mint(user1.address, 0))
        .to.be.revertedWithCustomError(jcoin, "ZeroAmount");
    });
  });

  describe("Batch Minting", function () {
    it("Should batch mint to multiple addresses", async function () {
      const recipients = [user1.address, user2.address];
      const amounts = [ethers.parseEther("100"), ethers.parseEther("200")];
      
      await jcoin.batchMint(recipients, amounts);
      
      expect(await jcoin.balanceOf(user1.address)).to.equal(amounts[0]);
      expect(await jcoin.balanceOf(user2.address)).to.equal(amounts[1]);
    });

    it("Should emit BatchMint event", async function () {
      const recipients = [user1.address, user2.address];
      const amounts = [ethers.parseEther("100"), ethers.parseEther("200")];
      const totalAmount = amounts[0] + amounts[1];
      
      await expect(jcoin.batchMint(recipients, amounts))
        .to.emit(jcoin, "BatchMint")
        .withArgs(owner.address, totalAmount, 2);
    });

    it("Should revert on array length mismatch", async function () {
      const recipients = [user1.address, user2.address];
      const amounts = [ethers.parseEther("100")];
      
      await expect(jcoin.batchMint(recipients, amounts))
        .to.be.revertedWithCustomError(jcoin, "ArrayLengthMismatch");
    });

    it("Should respect monthly cap in batch mint", async function () {
      const recipients = [user1.address, user2.address];
      const amounts = [MONTHLY_CAP, ethers.parseEther("1")];
      
      await expect(jcoin.batchMint(recipients, amounts))
        .to.be.revertedWithCustomError(jcoin, "ExceedsMonthlyCap");
    });

    it("Should batch mint equal amounts efficiently", async function () {
      const recipients = [user1.address, user2.address];
      const amountEach = ethers.parseEther("100");
      
      await jcoin.batchMintEqual(recipients, amountEach);
      
      expect(await jcoin.balanceOf(user1.address)).to.equal(amountEach);
      expect(await jcoin.balanceOf(user2.address)).to.equal(amountEach);
    });

    it("Should revert batchMintEqual with zero amount", async function () {
      const recipients = [user1.address, user2.address];
      
      await expect(jcoin.batchMintEqual(recipients, 0))
        .to.be.revertedWithCustomError(jcoin, "ZeroAmount");
    });
  });

  describe("Burning", function () {
    beforeEach(async function () {
      await jcoin.mint(user1.address, ethers.parseEther("1000"));
    });

    it("Should allow token holder to burn their tokens", async function () {
      const burnAmount = ethers.parseEther("100");
      await jcoin.connect(user1).burn(burnAmount);
      expect(await jcoin.balanceOf(user1.address)).to.equal(ethers.parseEther("900"));
    });

    it("Should reduce total supply when burning", async function () {
      const initialSupply = await jcoin.totalSupply();
      const burnAmount = ethers.parseEther("100");
      
      await jcoin.connect(user1).burn(burnAmount);
      
      expect(await jcoin.totalSupply()).to.equal(initialSupply - burnAmount);
    });

    it("Should allow burnFrom with approval", async function () {
      const burnAmount = ethers.parseEther("100");
      await jcoin.connect(user1).approve(owner.address, burnAmount);
      await jcoin.burnFrom(user1.address, burnAmount);
      
      expect(await jcoin.balanceOf(user1.address)).to.equal(ethers.parseEther("900"));
    });
  });

  describe("Pause/Unpause", function () {
    beforeEach(async function () {
      await jcoin.mint(user1.address, ethers.parseEther("1000"));
    });

    it("Should allow ADMIN to pause", async function () {
      await jcoin.pause();
      expect(await jcoin.paused()).to.be.true;
    });

    it("Should allow ADMIN to unpause", async function () {
      await jcoin.pause();
      await jcoin.unpause();
      expect(await jcoin.paused()).to.be.false;
    });

    it("Should not allow non-admin to pause", async function () {
      await expect(jcoin.connect(user1).pause()).to.be.reverted;
    });

    it("Should block transfers when paused", async function () {
      await jcoin.pause();
      await expect(
        jcoin.connect(user1).transfer(user2.address, ethers.parseEther("100"))
      ).to.be.revertedWith("Pausable: paused");
    });

    it("Should allow minting when paused", async function () {
      await jcoin.pause();
      await jcoin.mint(user2.address, ethers.parseEther("100"));
      expect(await jcoin.balanceOf(user2.address)).to.equal(ethers.parseEther("100"));
    });

    it("Should allow burning when paused", async function () {
      await jcoin.pause();
      await jcoin.connect(user1).burn(ethers.parseEther("100"));
      expect(await jcoin.balanceOf(user1.address)).to.equal(ethers.parseEther("900"));
    });
  });

  describe("Transfer Restrictions", function () {
    beforeEach(async function () {
      await jcoin.mint(user1.address, ethers.parseEther("1000"));
    });

    it("Should allow normal transfers by default", async function () {
      await jcoin.connect(user1).transfer(user2.address, ethers.parseEther("100"));
      expect(await jcoin.balanceOf(user2.address)).to.equal(ethers.parseEther("100"));
    });

    it("Should allow ADMIN to enable transfer restrictions", async function () {
      await jcoin.setTransferRestrictions(true);
      expect(await jcoin.transfersRestricted()).to.be.true;
    });

    it("Should emit event when changing transfer restrictions", async function () {
      await expect(jcoin.setTransferRestrictions(true))
        .to.emit(jcoin, "TransferRestrictionsUpdated")
        .withArgs(true);
    });

    it("Should block transfers when restricted", async function () {
      await jcoin.setTransferRestrictions(true);
      await expect(
        jcoin.connect(user1).transfer(user2.address, ethers.parseEther("100"))
      ).to.be.revertedWithCustomError(jcoin, "TransfersRestricted");
    });

    it("Should allow minting when transfers restricted", async function () {
      await jcoin.setTransferRestrictions(true);
      await jcoin.mint(user2.address, ethers.parseEther("100"));
      expect(await jcoin.balanceOf(user2.address)).to.equal(ethers.parseEther("100"));
    });

    it("Should allow burning when transfers restricted", async function () {
      await jcoin.setTransferRestrictions(true);
      await jcoin.connect(user1).burn(ethers.parseEther("100"));
      expect(await jcoin.balanceOf(user1.address)).to.equal(ethers.parseEther("900"));
    });

    it("Should not allow non-admin to change transfer restrictions", async function () {
      await expect(
        jcoin.connect(user1).setTransferRestrictions(true)
      ).to.be.reverted;
    });
  });

  describe("View Functions", function () {
    it("Should return remaining monthly mint correctly", async function () {
      expect(await jcoin.remainingMonthlyMint()).to.equal(MONTHLY_CAP);
      
      await jcoin.mint(user1.address, ethers.parseEther("100000"));
      expect(await jcoin.remainingMonthlyMint()).to.equal(ethers.parseEther("400000"));
    });

    it("Should return remaining total mint correctly", async function () {
      expect(await jcoin.remainingTotalMint()).to.equal(MAX_SUPPLY);
      
      await jcoin.mint(user1.address, ethers.parseEther("1000"));
      expect(await jcoin.remainingTotalMint()).to.equal(MAX_SUPPLY - ethers.parseEther("1000"));
    });

    it("Should return time until month reset", async function () {
      const timeRemaining = await jcoin.timeUntilMonthReset();
      expect(timeRemaining).to.be.gt(0);
      expect(timeRemaining).to.be.lte(MONTH_DURATION);
    });

    it("Should return 0 time when month has passed", async function () {
      await time.increase(MONTH_DURATION + 1);
      expect(await jcoin.timeUntilMonthReset()).to.equal(0);
    });

    it("Should return full monthly cap after month reset in view", async function () {
      await jcoin.mint(user1.address, ethers.parseEther("100000"));
      await time.increase(MONTH_DURATION + 1);
      expect(await jcoin.remainingMonthlyMint()).to.equal(MONTHLY_CAP);
    });
  });

  describe("Gas Optimization Tests", function () {
    it("Should be more gas efficient to use batchMint than multiple mints", async function () {
      const recipients = [];
      const amounts = [];
      
      for (let i = 0; i < 10; i++) {
        recipients.push(users[i].address);
        amounts.push(ethers.parseEther("100"));
      }

      const batchTx = await jcoin.batchMint(recipients, amounts);
      const batchReceipt = await batchTx.wait();
      const batchGas = batchReceipt.gasUsed;

      const JoinAdsCoin = await ethers.getContractFactory("JoinAdsCoin");
      const jcoin2 = await JoinAdsCoin.deploy(owner.address);

      let totalIndividualGas = 0n;
      for (let i = 0; i < 10; i++) {
        const tx = await jcoin2.mint(users[i].address, ethers.parseEther("100"));
        const receipt = await tx.wait();
        totalIndividualGas += receipt.gasUsed;
      }

      console.log(`Batch mint gas: ${batchGas}`);
      console.log(`Individual mints gas: ${totalIndividualGas}`);
      
      expect(batchGas).to.be.lt(totalIndividualGas);
    });

    it("Should be more gas efficient to use batchMintEqual for equal amounts", async function () {
      const recipients = [];
      
      for (let i = 0; i < 10; i++) {
        recipients.push(users[i].address);
      }

      const amountEach = ethers.parseEther("100");

      const equalTx = await jcoin.batchMintEqual(recipients, amountEach);
      const equalReceipt = await equalTx.wait();
      const equalGas = equalReceipt.gasUsed;

      const JoinAdsCoin = await ethers.getContractFactory("JoinAdsCoin");
      const jcoin2 = await JoinAdsCoin.deploy(owner.address);

      const amounts = recipients.map(() => amountEach);
      const batchTx = await jcoin2.batchMint(recipients, amounts);
      const batchReceipt = await batchTx.wait();
      const batchGas = batchReceipt.gasUsed;

      console.log(`batchMintEqual gas: ${equalGas}`);
      console.log(`batchMint gas: ${batchGas}`);
      
      expect(equalGas).to.be.lte(batchGas);
    });
  });

  describe("ERC20 Standard Compliance", function () {
    beforeEach(async function () {
      await jcoin.mint(user1.address, ethers.parseEther("1000"));
    });

    it("Should allow approval and transferFrom", async function () {
      await jcoin.connect(user1).approve(user2.address, ethers.parseEther("100"));
      await jcoin.connect(user2).transferFrom(user1.address, user2.address, ethers.parseEther("100"));
      
      expect(await jcoin.balanceOf(user2.address)).to.equal(ethers.parseEther("100"));
    });

    it("Should return correct allowance", async function () {
      await jcoin.connect(user1).approve(user2.address, ethers.parseEther("100"));
      expect(await jcoin.allowance(user1.address, user2.address)).to.equal(ethers.parseEther("100"));
    });

    it("Should support ERC165 interface detection", async function () {
      const accessControlId = "0x7965db0b";
      expect(await jcoin.supportsInterface(accessControlId)).to.be.true;
    });
  });
});
