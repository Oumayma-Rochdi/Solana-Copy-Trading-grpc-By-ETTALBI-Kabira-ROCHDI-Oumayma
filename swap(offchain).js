// This module provides an offchain swap function logic 
// It assumes you have a gRPC client generated from the IDL and a wallet/signer available.
import { swap } from "./swap.js";
import chalk from "chalk";

export async function offchainSwap({ fromToken, toToken, amount, walletAddress }) {
    const SOL_ADDRESS = "So11111111111111111111111111111111111111112";

    try {
        console.log(chalk.yellow("⚡ Executing offchain swap fallback logic..."));

        // Determine the swap direction
        let action, mint;
        if (fromToken === SOL_ADDRESS) {
            action = "BUY";
            mint = toToken;
        } else if (toToken === SOL_ADDRESS) {
            action = "SELL";
            mint = fromToken;
        } else {
            throw new Error("One of the tokens must be SOL for this offchain swap implementation");
        }

        // Reuse the highly optimized swap loop with JITO/Nozomi tip logic from swap.js
        const txid = await swap(action, mint, amount);

        if (txid) {
            console.log(chalk.green(`✅ Offchain Swap executed successfully: ${txid}`));
            return txid;
        } else {
            throw new Error("Offchain swap returned null txid");
        }
    } catch (error) {
        console.error(chalk.red("❌ Error executing offchain swap:"), error.message);
        throw error;
    }
}
