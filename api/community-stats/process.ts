import {
  handleCommunityStatsProcess,
  type CommunityStatsProcessRequest,
  type CommunityStatsProcessResponse,
} from '../../backend/community-stats-handler'

export const config = {
  maxDuration: 60,
}

export default async function handler(
  request: CommunityStatsProcessRequest,
  response: CommunityStatsProcessResponse,
): Promise<void> {
  await handleCommunityStatsProcess(request, response)
}
