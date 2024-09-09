use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    metadata::{
        create_metadata_accounts_v3, mpl_token_metadata::types::DataV2, CreateMetadataAccountsV3,
        Metadata as Metaplex,
    },
    token::{self, mint_to, Mint, MintTo, Token, TokenAccount, Transfer},
};

// Declare the program ID
declare_id!("3AD55KAgU7rd7zJByNS4gHL3w9hmb6YcWXvC7VmWbtYC");

#[program]
pub mod pda_token_account {
    use super::*;

    // Initialize a new token with metadata
    pub fn init_token(ctx: Context<InitToken>, metadata: InitTokenParams) -> Result<()> {
        // Define seeds and signer for PDA
        let seeds = &["mint".as_bytes(), &[ctx.bumps.mint]];
        let signer = [&seeds[..]];

        // Set token metadata
        let token_data: DataV2 = DataV2 {
            name: metadata.name,
            symbol: metadata.symbol,
            uri: metadata.uri,
            seller_fee_basis_points: 0,
            creators: None,
            collection: None,
            uses: None,
        };

        // Create metadata account context
        let metadata_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_metadata_program.to_account_info(),
            CreateMetadataAccountsV3 {
                payer: ctx.accounts.payer.to_account_info(),
                update_authority: ctx.accounts.mint.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                metadata: ctx.accounts.metadata.to_account_info(),
                mint_authority: ctx.accounts.mint.to_account_info(),
                system_program: ctx.accounts.system_program.to_account_info(),
                rent: ctx.accounts.rent.to_account_info(),
            },
            &signer,
        );

        // Create the metadata account
        create_metadata_accounts_v3(metadata_ctx, token_data, false, true, None)?;

        msg!("Token mint created successfully.");

        Ok(())
    }

    // Mint new tokens to a destination account
    pub fn mint_tokens(ctx: Context<MintTokens>, quantity: u64) -> Result<()> {
        // Define seeds and signer for PDA
        let seeds = &["mint".as_bytes(), &[ctx.bumps.mint]];
        let signer = [&seeds[..]];

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

        Ok(())
    }

    // Initialize a new PDA (Program Derived Address)
    pub fn init_pda(_ctx: Context<InitPDA>) -> Result<()> {
        // PDA creation is implicit in Anchor, as it's derived from seeds in the context
        Ok(())
    }

    // Transfer tokens to a PDA
    pub fn transfer_to_pda(ctx: Context<TransferToPda>, amount: u64) -> Result<()> {
        // Create transfer context
        let cpi_accounts = Transfer {
            from: ctx.accounts.from.to_account_info(),
            to: ctx.accounts.to.to_account_info(),
            authority: ctx.accounts.from_authority.to_account_info(),
        };

        // Transfer tokens
        token::transfer(
            CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts),
            amount,
        )?;
        Ok(())
    }

    // Transfer tokens from a PDA
    pub fn transfer_from_pda(ctx: Context<TransferFromPda>, amount: u64) -> Result<()> {
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
                signer,
            ),
            amount,
        )?;
        Ok(())
    }
}

// Context for initializing a token
#[derive(Accounts)]
#[instruction(
  params: InitTokenParams
)]
pub struct InitToken<'info> {
    /// CHECK: New Metaplex Account being created
    #[account(mut)]
    pub metadata: UncheckedAccount<'info>,
    #[account(
    init_if_needed,
    seeds = [b"mint"],
    bump,
    payer = payer,
    mint::decimals = params.decimals,
    mint::authority = mint,
  )]
    pub mint: Account<'info, Mint>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub token_metadata_program: Program<'info, Metaplex>,
}

// Define the parameters for initializing a token
#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone)]
pub struct InitTokenParams {
    pub name: String,
    pub symbol: String,
    pub uri: String,
    pub decimals: u8,
}

// Context for minting tokens
#[derive(Accounts)]
pub struct MintTokens<'info> {
    #[account(
    mut,
    seeds = [b"mint"],
    bump,
    mint::authority = mint,
  )]
    pub mint: Account<'info, Mint>,
    #[account(
    init_if_needed,
    payer = payer,
    associated_token::mint = mint,
    associated_token::authority = payer,
  )]
    pub destination: Account<'info, TokenAccount>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

// Context for initializing a PDA
#[derive(Accounts)]
pub struct InitPDA<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
    init_if_needed,
    // set the seeds to derive the PDA
    seeds = [b"pda"],
    // use the canonical bump
    bump,
    payer = payer,
    space = 8
  )]
    pub pda_account: Account<'info, PdaAccount>,
    #[account(
    init_if_needed,
    payer = payer,
    associated_token::mint = mint,
    associated_token::authority = pda_account
  )]
    pub token_account: Account<'info, TokenAccount>,
    #[account(
    mut,
    seeds = [b"mint"],
    bump,
    mint::authority = mint,
  )]
    pub mint: Account<'info, Mint>,
    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

// Define a PDA account
#[account]
pub struct PdaAccount {}

// Context for transferring tokens to a PDA
#[derive(Accounts)]
pub struct TransferToPda<'info> {
    #[account(mut)]
    pub from: Account<'info, TokenAccount>,
    #[account(mut)]
    pub to: Account<'info, TokenAccount>,
    pub from_authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

// Context for transferring tokens from a PDA
#[derive(Accounts)]
pub struct TransferFromPda<'info> {
    #[account(mut)]
    pub from: Account<'info, TokenAccount>,
    #[account(mut)]
    pub to: Account<'info, TokenAccount>,
    #[account(
    seeds = [b"pda"],
    bump,
  )]
    pub from_pda: Account<'info, PdaAccount>,
    pub token_program: Program<'info, Token>,
}
