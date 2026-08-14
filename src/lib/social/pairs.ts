export function canonicalPair(userId: string, otherUserId: string) {
  const [userAId, userBId] = [userId, otherUserId].sort();
  return { userAId, userBId, pairKey: `${userAId}:${userBId}` };
}

export function otherParticipant<T extends { userAId: string; userBId: string }>(
  pair: T,
  userId: string,
) {
  return pair.userAId === userId ? pair.userBId : pair.userAId;
}

export function canAcceptFriendship(
  friendship: { addresseeId: string; status: string },
  userId: string,
) {
  return friendship.addresseeId === userId && friendship.status === "PENDING";
}

export function canManagePair(pair: { userAId: string; userBId: string }, userId: string) {
  return pair.userAId === userId || pair.userBId === userId;
}
