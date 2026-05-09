// useProfile() / useProfiles() — subscribe a component to the profile
// registry so the UI re-renders when the active profile changes or the
// list of profiles is mutated.

import { useEffect, useState } from 'react';
import {
  getActiveProfile,
  listProfiles,
  onProfileChange,
  type Profile,
} from '@/utils/profiles';

function useProfileVersion(): number {
  const [v, setV] = useState(0);
  useEffect(() => onProfileChange(() => setV((x) => x + 1)), []);
  return v;
}

export function useActiveProfile(): Profile {
  useProfileVersion();
  return getActiveProfile();
}

export function useProfiles(): Profile[] {
  useProfileVersion();
  return listProfiles();
}
