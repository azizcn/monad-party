require("dotenv").config();
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    const [deployer] = await ethers.getSigners();

    console.log("=".repeat(50));
    console.log("  Deploying MonadPartyGame to Monad Testnet");
    console.log("=".repeat(50));
    console.log(`  Deployer: ${deployer.address}`);

    const balance = await ethers.provider.getBalance(deployer.address);
    console.log(`  Balance:  ${ethers.formatEther(balance)} MON`);

    if (balance === 0n) {
        throw new Error("Deployer wallet has zero balance. Get MON at https://faucet.monad.xyz");
    }

    console.log("\n⏳ Deploying...");
    const MonadPartyGame = await ethers.getContractFactory("MonadPartyGame");
    const game = await MonadPartyGame.deploy(deployer.address);
    await game.waitForDeployment();

    const address = await game.getAddress();
    const txHash = game.deploymentTransaction()?.hash;

    console.log(`\n✅ Contract deployed!`);
    console.log(`   Address:  ${address}`);
    console.log(`   Tx Hash:  ${txHash}`);
    console.log(`   Explorer: https://testnet.monadexplorer.com/address/${address}`);

    // ── Auto-update .env files ────────────────────────────────────────────────

    const backendEnvPath = path.resolve(__dirname, "../../backend/.env");
    const frontendEnvPath = path.resolve(__dirname, "../../frontend/.env");

    function upsertEnv(filePath, key, value) {
        let content = "";
        if (fs.existsSync(filePath)) {
            content = fs.readFileSync(filePath, "utf-8");
        }
        const regex = new RegExp(`^${key}=.*$`, "m");
        const line = `${key}=${value}`;
        if (regex.test(content)) {
            content = content.replace(regex, line);
        } else {
            content = content ? `${content}\n${line}` : line;
        }
        fs.writeFileSync(filePath, content);
        console.log(`   Updated ${filePath}`);
    }

    upsertEnv(backendEnvPath, "CONTRACT_ADDRESS", address);
    upsertEnv(frontendEnvPath, "VITE_CONTRACT_ADDRESS", address);

    console.log("\n🎮 Ready! Run backend and frontend to start playing.");
    console.log("=".repeat(50));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Deployment failed:");
        console.error(error);
        process.exit(1);
    });
