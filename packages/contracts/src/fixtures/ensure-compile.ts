/**
 * Pulls fixture modules into the compilation unit without exporting them
 * from the public package entry.
 */
import { assertRedemptionCommandFrozen, fixtureCommands } from './examples';

assertRedemptionCommandFrozen();
void fixtureCommands.redeem;
