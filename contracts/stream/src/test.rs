#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, AuthorizedFunction, Ledger},
    Address, Env,
};
use token::{TokenContract, TokenContractClient};

fn setup_test_env(
    env: &Env,
) -> (
    Address,
    Address,
    Address,
    StreamContractClient<'static>,
    TokenContractClient<'static>,
) {
    env.mock_all_auths();

    // Register token contract
    let admin = Address::generate(env);
    let token_id = env.register_contract(None, TokenContract);
    let token_client = TokenContractClient::new(env, &token_id);
    token_client.initialize(&admin);

    // Register stream contract
    let stream_id = env.register_contract(None, StreamContract);
    let stream_client = StreamContractClient::new(env, &stream_id);

    let sender = Address::generate(env);
    let recipient = Address::generate(env);

    // Mint tokens to sender
    token_client.mint(&sender, &1000);

    (sender, recipient, token_id, stream_client, token_client)
}

#[test]
fn test_create_stream_locks_deposit() {
    let env = Env::default();
    let (sender, recipient, token_id, stream_client, token_client) = setup_test_env(&env);

    env.ledger().set_timestamp(100);
    let stream_id = stream_client.create_stream(&sender, &recipient, &token_id, &100, &10);

    assert_eq!(stream_id, 1);
    assert_eq!(token_client.balance(&sender), 900);
    assert_eq!(token_client.balance(&stream_client.address), 100);

    let stream = stream_client.get_stream(&1);
    assert_eq!(stream.sender, sender);
    assert_eq!(stream.recipient, recipient);
    assert_eq!(stream.deposit, 100);
    assert_eq!(stream.start_time, 100);
    assert_eq!(stream.duration, 10);
    assert_eq!(stream.withdrawn, 0);
    assert_eq!(stream.token, token_id);
}

#[test]
fn test_vested_amount_calculation() {
    let env = Env::default();
    let (sender, recipient, token_id, stream_client, _) = setup_test_env(&env);

    env.ledger().set_timestamp(100);
    stream_client.create_stream(&sender, &recipient, &token_id, &100, &10);

    // Test 2: vested_amount returns 0 at t=0
    assert_eq!(stream_client.vested_amount(&1), 0);

    // vested_amount returns ~50% at t=duration/2 (t = 105)
    env.ledger().set_timestamp(105);
    assert_eq!(stream_client.vested_amount(&1), 50);

    // vested_amount returns 100% at t>=duration (t = 110)
    env.ledger().set_timestamp(110);
    assert_eq!(stream_client.vested_amount(&1), 100);

    // vested_amount returns 100% at t = 115 (past duration)
    env.ledger().set_timestamp(115);
    assert_eq!(stream_client.vested_amount(&1), 100);
}

#[test]
fn test_withdraw_transfers_vested_amount() {
    let env = Env::default();
    let (sender, recipient, token_id, stream_client, token_client) = setup_test_env(&env);

    env.ledger().set_timestamp(100);
    stream_client.create_stream(&sender, &recipient, &token_id, &100, &10);

    // Move to 50% vesting
    env.ledger().set_timestamp(105);

    // Test 3: withdraw correctly transfers vested-and-not-yet-withdrawn amount
    let withdrawn = stream_client.withdraw(&1);
    assert_eq!(withdrawn, 50);

    // Check balances
    assert_eq!(token_client.balance(&recipient), 50);
    assert_eq!(token_client.balance(&stream_client.address), 50);

    // Move to 100% vesting
    env.ledger().set_timestamp(110);
    let withdrawn_again = stream_client.withdraw(&1);
    assert_eq!(withdrawn_again, 50);
    assert_eq!(token_client.balance(&recipient), 100);
    assert_eq!(token_client.balance(&stream_client.address), 0);
}

#[test]
fn test_withdraw_requires_recipient_auth() {
    let env = Env::default();
    let (sender, recipient, token_id, stream_client, _) = setup_test_env(&env);

    env.ledger().set_timestamp(100);
    stream_client.create_stream(&sender, &recipient, &token_id, &100, &10);

    env.ledger().set_timestamp(105);

    // Call withdraw. Because mock_all_auths is on, it succeeds, but we will assert
    // that the recipient's authorization was required for the withdraw call.
    stream_client.withdraw(&1);

    let auths = env.auths();
    assert_eq!(auths.len(), 1);
    let (auth_address, invocation) = &auths[0];
    assert_eq!(auth_address, &recipient);

    match &invocation.function {
        AuthorizedFunction::Contract((address, name, _args)) => {
            assert_eq!(address, &stream_client.address);
            assert_eq!(name, &soroban_sdk::Symbol::new(&env, "withdraw"));
        }
        _ => panic!("unexpected auth function"),
    }
}

#[test]
#[should_panic]
fn test_create_stream_fails_for_zero_deposit() {
    let env = Env::default();
    let (sender, recipient, token_id, stream_client, _) = setup_test_env(&env);

    stream_client.create_stream(&sender, &recipient, &token_id, &0, &10);
}

#[test]
#[should_panic]
fn test_create_stream_fails_for_zero_duration() {
    let env = Env::default();
    let (sender, recipient, token_id, stream_client, _) = setup_test_env(&env);

    stream_client.create_stream(&sender, &recipient, &token_id, &100, &0);
}

#[test]
fn test_cancel_stream() {
    let env = Env::default();
    let (sender, recipient, token_id, stream_client, token_client) = setup_test_env(&env);

    env.ledger().set_timestamp(100);
    stream_client.create_stream(&sender, &recipient, &token_id, &100, &10);

    // Cancel at t=5 (50% vested)
    env.ledger().set_timestamp(105);
    stream_client.cancel_stream(&1);

    // Vested (50) should go to recipient, remainder (50) should go back to sender.
    assert_eq!(token_client.balance(&sender), 950);
    assert_eq!(token_client.balance(&recipient), 50);
    assert_eq!(token_client.balance(&stream_client.address), 0);

    // Verify stream state has been updated
    let stream = stream_client.get_stream(&1);
    assert_eq!(stream.deposit, 50);
    assert_eq!(stream.duration, 5);
    assert_eq!(stream.withdrawn, 50);
}

#[test]
fn test_list_streams_for_sender_and_recipient() {
    let env = Env::default();
    let (sender, recipient, token_id, stream_client, _) = setup_test_env(&env);
    let other_recipient = Address::generate(&env);

    stream_client.create_stream(&sender, &recipient, &token_id, &100, &10);
    stream_client.create_stream(&sender, &other_recipient, &token_id, &100, &10);

    assert_eq!(
        stream_client.list_streams_for(&sender),
        Vec::from_array(&env, [1, 2])
    );
    assert_eq!(
        stream_client.list_streams_for(&recipient),
        Vec::from_array(&env, [1])
    );
    assert_eq!(
        stream_client.list_streams_for(&other_recipient),
        Vec::from_array(&env, [2])
    );
}

#[test]
fn test_partial_withdrawals_only_transfer_newly_vested_amount() {
    let env = Env::default();
    let (sender, recipient, token_id, stream_client, token_client) = setup_test_env(&env);

    env.ledger().set_timestamp(100);
    stream_client.create_stream(&sender, &recipient, &token_id, &100, &10);

    env.ledger().set_timestamp(103);
    assert_eq!(stream_client.withdraw(&1), 30);

    env.ledger().set_timestamp(107);
    assert_eq!(stream_client.withdraw(&1), 40);
    assert_eq!(token_client.balance(&recipient), 70);
    assert_eq!(stream_client.get_stream(&1).withdrawn, 70);
}

#[test]
fn test_cancel_after_partial_withdrawal_settles_remaining_funds() {
    let env = Env::default();
    let (sender, recipient, token_id, stream_client, token_client) = setup_test_env(&env);

    env.ledger().set_timestamp(100);
    stream_client.create_stream(&sender, &recipient, &token_id, &100, &10);

    env.ledger().set_timestamp(103);
    stream_client.withdraw(&1);

    env.ledger().set_timestamp(106);
    stream_client.cancel_stream(&1);

    assert_eq!(token_client.balance(&sender), 940);
    assert_eq!(token_client.balance(&recipient), 60);
    assert_eq!(token_client.balance(&stream_client.address), 0);

    let stream = stream_client.get_stream(&1);
    assert_eq!(stream.deposit, 60);
    assert_eq!(stream.withdrawn, 60);
}

#[test]
fn test_self_stream_is_listed_only_once() {
    let env = Env::default();
    let (sender, _, token_id, stream_client, _) = setup_test_env(&env);

    stream_client.create_stream(&sender, &sender, &token_id, &100, &10);

    assert_eq!(
        stream_client.list_streams_for(&sender),
        Vec::from_array(&env, [1])
    );
}
