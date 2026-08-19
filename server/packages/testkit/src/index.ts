/**
 * `@eigeninteractive/testkit`: drive a game's rules through the real kernel without a
 * Worker, a database or a network. Build a table, submit actions as seats,
 * assert on the resulting transitions and per-seat observations.
 *
 * @module @eigeninteractive/testkit
 */

export { checkConfiguredGameContract, emitConfiguredGameContract } from "./contract-command.js";
export {
  type BuildGameContractOptions,
  buildGameContract,
  checkGameContract,
  type EmitGameContractOptions,
  emitGameContract,
  GAME_CONTRACT_FORMAT_VERSION,
  type GameContract,
  type GameContractFixture,
  type GameContractVersion,
  gameContractFilename,
  gameContractJson,
} from "./game-contract.js";
export {
  type CommitInput,
  type CommitPlan,
  commit,
  DEADLINE_GRACE_MS,
  deriveRng,
  type Effect,
  type GameRow,
  type Intent,
  isRejected,
  type ObservationFrame,
  projectView,
  type RejectCode,
  type Rejected,
  randomSeed,
  type Seat,
  type SeatView,
  type StateRow,
} from "./kernel-scenarios.js";
export {
  type ActionCase,
  type BotSeatableCase,
  deepEquals,
  evaluateTwinCase,
  type PlayerLimitsCase,
  parseTwinFixtureFile,
  type RatingPoolCase,
  type TwinFixtureCase,
  type TwinFixtureFile,
  twinFixtureTests,
} from "./twin-fixtures.js";
