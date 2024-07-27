# PDA and Associated Token Account Management with Anchor

## Overview
This project demonstrates the implementation and management of Program Derived Addresses (PDAs) and associated token accounts on the Solana blockchain using the Anchor framework. It includes functionalities for creating PDAs, managing associated token accounts, and transferring tokens to and from these accounts.

## Table of Contents
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
  - [Clone the Repository](#clone-the-repository)
  - [Create user wallet](#create-user-wallet)
  - [Configure Solana cluster](#configure-solana-cluster)
  - [Get user wallet address](#get-user-wallet-address)
  - [Airdrop](#airdrop)
- [Instructions](#instructions)
  - [Deploying the Program on Devnet](#deploying-the-program-on-devnet)
    1. [Build program](#build-program)
    2. [Update Program IDs](#update-program-ids)
    3. [Rebuild and deploy program](#rebuild-program)
  - [Testing](#testing)
  - [Break down interacting with the PDA](#break-down-interacting-with-the-pda)
    1. [Customize token metadata](#customize-token-metadata)
    2. [Create token account](#create-token_account)
    3. [Mint tokens](#mint-tokens)
    4. [Create PDA and Associated Token Account](#create-pda-and-associated-token-account)
    5. [Transfer tokens to the PDA’s associated token account](#transfer-tokens-to-pda)
    6. [Transfer tokens from the PDA’s associated token account](#transfer-tokens-from-pda)
- [License](#license)
- [Acknowledgments](#acknowledgments)

## Features

- Creation of Program Derived Addresses (PDAs)
- Management of associated token accounts
- Token transfer to and from PDA’s associated token account
- Comprehensive tests to verify the operations

## Prerequisites

Ensure you have the following installed:

- [**Rust** and **Cargo**](https://www.rust-lang.org/tools/install)
- [**Solana CLI**](https://docs.solanalabs.com/cli/install)
- [**Node.js** and **npm**](https://github.com/nvm-sh/nvm)
- [**yarn**](https://yarnpkg.com/getting-started/install)
- [**Anchor CLI**](https://www.anchor-lang.com/docs/installation)

## Getting Started

### Clone the Repository

```bash
git clone https://github.com/animber1/pda-token-account.git
cd pda-associated-token-account
```

### Create user wallet
```bash
solana-keygen new
```

### Configure Solana cluster
```bash
solana config set --url https://api.devnet.solana.com
```

### Get user wallet address
```bash
solana address
```

### Airdrop

One needs at least 5 SOL for deploying and testing this program. You can request an airdrop for devnet on the Solana official faucet page (https://faucet.solana.com/).

NOTE: To unlock higher a airdrop limit, you need to connect your GitHub.

## Instructions

### Deploying the Program on Devnet

To deploy **pda_token_account** Program to the Solana Devnet:

1. <a id="build-program"></a>Build program:
    ```sh
    anchor build
    ```

2. <a id="update-program-ids"></a>Update Program IDs:
    ```sh
    anchor keys list
    ```

    This command will output:
    ```sh
    anchor keys list
    pda_token_account: 3AD55KAgU7rd7zJByNS4gHL3w9hmb6YcWXvC7VmWbtYC
    ```

    Replace Program IDs with this **pda_token_account** Program ID.

    programs/pda-token-account/src/lib.rs, line 14:
    ```rust
    // Declare the program ID
    declare_id!("3AD55KAgU7rd7zJByNS4gHL3w9hmb6YcWXvC7VmWbtYC");
    ```

    Anchor.toml, line 9:
    ```toml
    [programs.devnet]
    pda_token_account = "3AD55KAgU7rd7zJByNS4gHL3w9hmb6YcWXvC7VmWbtYC"
    ```

3. <a id="rebuild-program"></a>Rebuild and deploy program:
    
    Rebuild program with new Program ID.
    ```sh
    anchor build
    ```

    Deploy program.
    ```sh
    anchor deploy
    ```    

    If you run into an RPC error, you can use your own RPC cluster (by default, Solana offical devnet cluster).
    
    For example, if you use **helius-rpc** and have an api access key, replace the ```cluster``` variable value with it.
    
    Anchor.toml, line 15:
    ```toml
    cluster = "https://devnet.helius-rpc.com/?api-key=11111-74a7-4611-9dd7-0787a55574ad"
    ```

### Testing
To run the tests and ensure the PDA and associated token account operations are working correctly, use the following command:

```sh
anchor test --skip-deploy
```

### Break down interacting with the PDA

1. <a id="customize-token-metadata"></a>Customize token metadata:

    changing **metadata** variable in pda-token-account.test.ts, line 51:
    
    ```js
    // Metadata for the token
    const metadata = {
      name: "Insomnia Token", // token name
      symbol: "INSOMNIA",     // token symbol
      uri: "https://5vfxc4tr6xoy23qefqbj4qx2adzkzapneebanhcalf7myvn5gzja.arweave.net/7UtxcnH13Y1uBCwCnkL6APKsge0hAgacQFl-zFW9NlI",
                              // token image
      decimals: 9,            // token decimals
    };
    ```

2. <a id="create-token_account"></a>Create token account:
    
    Run **init_token** function in **pda_token_account** program.
    
    ```js
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
    ```

    Create a token using **anchor_spl::metadata::create_metadata_accounts_v3** in **init_token** function, line 21.

    ```rust
    ...
    // Create the metadata account
    create_metadata_accounts_v3(
      metadata_ctx,
      token_data,
      false,
      true,
      None,
    )?;
    ```    

    Please note that **mint** is also a PDA account.

3. <a id="mint-tokens"></a>Mint tokens:

    Run **mint_tokens** function in **pda_token_account** program.
    
    ```js
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
    ```

    Mint tokens using **anchor_spl::token::mint_to** in **mint_tokens** function, line 67.
    ```rust
    // Mint tokens to the destination account
    mint_to(
      CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        MintTo {
          authority: ctx.accounts.mint.to_account_info(),
          to: ctx.accounts.destination.to_account_info(),
          mint: ctx.accounts.mint.to_account_info(),
        },
        &signer,
      ),
      quantity,
    )?;
    ```

4. <a id="create-pda-and-associated-token-account"></a>Create PDA and Associated Token Account:
    
    Run **init_pda** function in **pda_token_account** program.

    ```js
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
    ```

    PDA creation is implicit in Anchor, as it's derived from seeds in the context.

    ```rust
    // Context for initializing a PDA
    #[derive(Accounts)]
    pub struct InitPDA<'info> {
      ...
      #[account(
        init_if_needed,   // PDA account is initialized if needed
        // set the seeds to derive the PDA
        seeds = [b"pda"],
        // use the canonical bump
        bump,
        payer = payer,
        space = 8
      )]
      pub pda_account: Account<'info, PdaAccount>,
      #[account(
        init_if_needed,   // Associated token account is initialized if needed
        payer = payer,
        associated_token::mint = mint,
        associated_token::authority = pda_account
      )]
      pub token_account: Account<'info, TokenAccount>,
      ...
    }
    ```

5. <a id="transfer-tokens-to-pda"></a>Transfer tokens to the PDA’s associated token account:

    Run **transfer_to_pda** function in **pda_token_account** program.

    ```js
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
    ```
    
    Transfer tokens to PDA using **anchor_spl::token::transfer** in **transfer_to_pda** function, line 96.

    ```rust
    // Create transfer context
    let cpi_accounts = Transfer {
      from: ctx.accounts.from.to_account_info(),
      to: ctx.accounts.to.to_account_info(),
      authority: ctx.accounts.from_authority.to_account_info(),
    };

    // Transfer tokens
    token::transfer(
      CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        cpi_accounts
      ),
      amount
    )?;
    ```

6. <a id="transfer-tokens-from-pda"></a>Transfer tokens from the PDA’s associated token account:
    
    Run **transfer_from_pda** function in **pda_token_account** program.

    ```js
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
    ```

    Transfer tokens from PDA using **anchor_spl::token::transfer** in **transfer_from_pda** function, line 116.

    ```rust
    // Define seeds and signer for PDA
    let seeds: &[&[u8]] = &[b"pda".as_ref(), &[ctx.bumps.from_pda]];
    let signer = &[&seeds[..]];

    // Create transfer context
    let cpi_accounts = Transfer {
      from: ctx.accounts.from.to_account_info(),
      to: ctx.accounts.to.to_account_info(),
      authority: ctx.accounts.from_pda.to_account_info(),
    };
    // Transfer tokens with signer
    token::transfer(
      CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        cpi_accounts,
        signer
      ),
      amount
    )?;
    ```
    
    Please note the transfer transaction should be signed with the PDA account's seeds.

## License
This project is licensed under the MIT License. See the LICENSE file for details.

## Acknowledgments
Special thanks to the Solana and Anchor community for their support and documentation.

Feel free to customize the content to better fit your project's specifics and personal preferences.
