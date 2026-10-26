/**
 * Pulls fixture modules into the compilation unit without exporting them
 * from the public package entry.
 */
import './vcx-read-contracts';
import {
  assertOfflineSyncCommandFrozen,
  assertRedemptionCommandFrozen,
  fixtureCommands,
  fixtureOfflineSyncRequest,
} from './examples';

assertRedemptionCommandFrozen();
assertOfflineSyncCommandFrozen();
void fixtureCommands.redeem;
void fixtureCommands.offlineSync;
void fixtureOfflineSyncRequest.events[0]?.clientEventId;
