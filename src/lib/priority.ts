import type { AllVotes } from "./consensus";

/** 2人とも「どちらでも」と答えたもの＝優先度が低く、作戦から外しやすいもの */
export const isLowPriority = (votes: AllVotes, rideId: string): boolean => votes.toshi[rideId] === "either" && votes.tsuma[rideId] === "either";

/** どちらか1人でも「乗らない（行かない）」と答えたもの＝作戦には入れない */
export const isVetoed = (votes: AllVotes, rideId: string): boolean => votes.toshi[rideId] === "skip" || votes.tsuma[rideId] === "skip";
