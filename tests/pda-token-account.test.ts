import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { PdaTokenAccount } from "../target/types/pda_token_account";
import {
  Transaction,
  sendAndConfirmTransaction,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync
} from "@solana/spl-token";
import * as assert from "assert";

describe("pda-token-account", () => {
  // Set up the provider to connect to the Solana network (localnet, devnet, or mainnet)
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider); // Set the provider globally for the Anchor library

  // Get the program instance using the workspace reference
  const program = anchor.workspace.PdaTokenAccount as Program<PdaTokenAccount>;

  // Get the wallet instance from the provider
  const wallet = provider.wallet as anchor.Wallet;

  // Get the connection instance from the provider
  const connection = provider.connection;

  // Define the public key of the Token Metadata program (Metaplex)
  const TOKEN_METADATA_PROGRAM_ID = 
    new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

  // Define seeds used for deriving PDAs (Program Derived Addresses)
  const METADATA_SEED = "metadata";
  const MINT_SEED = "mint";
  const PDA_SEED = "pda";

  // Define the payer as the wallet's public key
  const payer = wallet.publicKey;

  // Derive the mint address using a seed and the program ID
  const [mint] = PublicKey.findProgramAddressSync(
    [Buffer.from(MINT_SEED)],
    program.programId
  );

  // Metadata for the token
  const metadata = {
    name: "Insomnia Token",
    symbol: "INSOMNIA",
    uri: "https://5vfxc4tr6xoy23qefqbj4qx2adzkzapneebanhcalf7myvn5gzja.arweave.net/7UtxcnH13Y1uBCwCnkL6APKsge0hAgacQFl-zFW9NlI",
    decimals: 9,
  };

  // Derive the metadata address using seeds, the Token Metadata program ID, and the mint address
  const [metadataAddress] = PublicKey.findProgramAddressSync(
    [
      Buffer.from(METADATA_SEED),
      TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    TOKEN_METADATA_PROGRAM_ID
  );

  // Variables for the PDA and associated token accounts
  let pda: PublicKey;
  let pdaTokenAccount: PublicKey;
  let sourceTokenAccount: PublicKey;

  // Helper function to get the balance of a token account
  const getTokenAccountBalance = async (account: PublicKey): Promise<number> => {
    let balance = 0;
    try {
      balance = (
        await connection.getTokenAccountBalance(account)
      ).value.uiAmount;
    } catch (error) {

    }
    return balance;
  }

  // Test to create the mint account
  it("Create mint account", async () => {
    // Check if the mint account already exists
    const info = await connection.getAccountInfo(mint);
    if (info) {
      return; // Do not attempt to initialize if already initialized
    }
    console.log("  Mint not found. Attempting to initialize.");

    // Define the context for the initToken method
    const context = {
      metadata: metadataAddress,
      mint: mint,
      payer: payer,
      rent: SYSVAR_RENT_PUBKEY,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
    };

    // Create the instruction to initialize the token
    const initToken = await program.methods
      .initToken(metadata)
      .accounts(context)
      .instruction();

    // Create a transaction and add the instruction to it
    const transaction = new Transaction().add(
      initToken
    );

    // Send the transaction and confirm it
    await sendAndConfirmTransaction(
      connection,
      transaction,
      [wallet.payer],
      { skipPreflight: true }
    );

    // Verify that the mint account has been initialized
    const newInfo = await connection.getAccountInfo(mint);
    assert.ok(newInfo, "  Mint should be initialized.");
  });

  // Test to mint tokens
  it("Mint tokens", async () => {
    // Derive the associated token account for the payer
    sourceTokenAccount = getAssociatedTokenAddressSync(
      mint,
      payer,
      true,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    // Get the initial balance of the source token account
    let initialBalance = await getTokenAccountBalance(sourceTokenAccount);

    // Define the context for the mintTokens method
    const context = {
      mint: mint,
      destination: sourceTokenAccount,
      payer: payer,
      rent: SYSVAR_RENT_PUBKEY,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    };

    // Amount of tokens to mint
    const mintAmount = 10;
    const mintTokens = await program.methods
      .mintTokens(new BN(mintAmount * 10 ** metadata.decimals))
      .accounts(context)
      .instruction();

    // Create a transaction and add the instruction to it
    const transaction = new Transaction().add(
      mintTokens
    );

    // Send the transaction and confirm it
    await sendAndConfirmTransaction(
      connection,
      transaction,
      [wallet.payer],
      { skipPreflight: true }
    );

    // Get the post-mint balance of the source token account
    const postBalance = await getTokenAccountBalance(sourceTokenAccount);

    // Verify the post-mint balance
    assert.equal(
      initialBalance + mintAmount,
      postBalance,
      "Post balance should equal initial plus mint amount"
    );
  });

  // Test to create the PDA account
  it("Create PDA account", async () => {
    // Derive the PDA address using a seed and the program ID
    [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from(PDA_SEED)],
      program.programId
    );

    // Derive the associated token account for the PDA
    pdaTokenAccount = getAssociatedTokenAddressSync(
      mint,
      pda,
      true,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    // Define the context for the initPda method
    const context = {
      payer: payer,
      pdaAccount: pda,
      tokenAccount: pdaTokenAccount,
      mint: mint,
      rent: SYSVAR_RENT_PUBKEY,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
    };

    // Create the instruction to initialize the PDA
    const initPda = await program.methods
      .initPda()
      .accounts(context)
      .instruction();

    // Create a transaction and add the instruction to it
    const transaction = new Transaction().add(
      initPda
    );

    // Send the transaction and confirm it
    await sendAndConfirmTransaction(
      connection,
      transaction,
      [wallet.payer],
      { skipPreflight: true }
    );
  });

  // Test to transfer tokens from the wallet to the PDA
  it("Transfer tokens from wallet to PDA", async () => {
    // Get the initial balances of the source and destination token accounts
    const sourceInitialBalance = await getTokenAccountBalance(sourceTokenAccount);
    const destInitialBalance = await getTokenAccountBalance(pdaTokenAccount);

    // Define the context for the transferToPda method
    const context = {
      from: sourceTokenAccount,
      to: pdaTokenAccount,
      fromAuthority: payer,
      tokenProgram: TOKEN_PROGRAM_ID,
    };

    // Amount of tokens to transfer
    const transferAmount = 5;
    const transferToPda = await program.methods
      .transferToPda(new BN(transferAmount * 10 ** metadata.decimals))
      .accounts(context)
      .instruction();

    // Create a transaction and add the instruction to it
    const transaction = new Transaction().add(
      transferToPda
    );

    // Send the transaction and confirm it
    await sendAndConfirmTransaction(
      connection,
      transaction,
      [wallet.payer],
      { skipPreflight: true }
    );

    // Get the post-transfer balances of the source and destination token accounts
    const sourcePostBalance = await getTokenAccountBalance(sourceTokenAccount);
    const destPostBalance = await getTokenAccountBalance(pdaTokenAccount);

    // Verify the post-transfer balances
    assert.equal(
      sourceInitialBalance - transferAmount,
      sourcePostBalance,
      "Source account balance is not correct."
    );
    assert.equal(
      destInitialBalance + transferAmount,
      destPostBalance,
      "Destination account balance is not correct."
    );
  });

  // Test to transfer tokens from the PDA to the wallet
  it("Transfer tokens from PDA to wallet", async () => {
    // Get the initial balances of the source and destination token accounts
    const sourceInitialBalance = await getTokenAccountBalance(pdaTokenAccount);
    const destInitialBalance = await getTokenAccountBalance(sourceTokenAccount);

    // Define the context for the transferFromPda method
    const context = {
      from: pdaTokenAccount,
      to: sourceTokenAccount,
      fromPda: pda,
      tokenProgram: TOKEN_PROGRAM_ID,
    };

    // Amount of tokens to transfer
    const transferAmount = 5;
    const transferFromPda = await program.methods
      .transferFromPda(new BN(transferAmount * 10 ** metadata.decimals))
      .accounts(context)
      .instruction();

    // Create a transaction and add the instruction to it
    const transaction = new Transaction().add(
      transferFromPda
    );

    // Send the transaction and confirm it
    const txSig = await sendAndConfirmTransaction(
      connection,
      transaction,
      [wallet.payer],
      { skipPreflight: true }
    );

    // Get the post-transfer balances of the source and destination token accounts
    const sourcePostBalance = await getTokenAccountBalance(pdaTokenAccount);
    const destPostBalance = await getTokenAccountBalance(sourceTokenAccount);

    // Verify the post-transfer balances
    assert.equal(
      sourceInitialBalance - transferAmount,
      sourcePostBalance,
      "Source account balance is not correct."
    );
    assert.equal(
      destInitialBalance + transferAmount,
      destPostBalance,
      "Destination account balance is not correct."
    );
  });
});
