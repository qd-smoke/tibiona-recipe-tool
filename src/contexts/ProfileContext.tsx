'use client';

import React, { createContext, useContext } from 'react';
import type { PermissionProfile } from '@/types';

type ProfileContextType = {
  profile: PermissionProfile | null;
};

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export function ProfileProvider({
  children,
  profile,
}: {
  children: React.ReactNode;
  profile: PermissionProfile | null;
}) {
  return (
    <ProfileContext.Provider value={{ profile }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
}
