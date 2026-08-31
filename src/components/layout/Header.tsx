import React from 'react';
import { Plus, LogOut, User } from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { NeoButton } from '../ui/NeoButton';
import { useAuthActions } from '@convex-dev/auth/react';
import { UserProfile } from '../../types';

interface HeaderProps {
  user?: UserProfile | null;
  onOpenTransactionModal: () => void;
  onOpenPinSetup: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  onOpenTransactionModal,
}) => {
  const { signOut } = useAuthActions();

  return (
    <header className="w-full bg-white border-b-[3px] border-[#121212] px-4 sm:px-6 py-3 flex items-center justify-between sticky top-0 z-30 shadow-neo-sm">
      
      {/* Brand Logo */}
      <div className="flex items-center gap-4">
        <BrandLogo size="md" showSubtitle={false} />
      </div>

      {/* Action Controls */}
      <div className="flex items-center gap-2.5 sm:gap-3.5">
        
        {/* Add Transaction Button */}
        <NeoButton
          variant="secondary"
          size="sm"
          onClick={onOpenTransactionModal}
          className="flex items-center gap-1.5"
        >
          <Plus size={16} strokeWidth={3} />
          <span className="hidden sm:inline">Add Transaction</span>
          <span className="sm:hidden">Add</span>
        </NeoButton>

        {/* User Badge / Avatar & Sign Out */}
        <div className="flex items-center gap-2 pl-2 border-l-2 border-neutral-300">
          {user?.image ? (
            <img
              src={user.image}
              alt={user.name || 'User'}
              className="w-8 h-8 rounded-none border-2 border-[#121212] shadow-neo-sm object-cover"
            />
          ) : (
            <div className="w-8 h-8 bg-[#00F0FF] border-2 border-[#121212] shadow-neo-sm flex items-center justify-center font-black text-xs">
              {user?.name ? user.name.slice(0, 2).toUpperCase() : <User size={14} />}
            </div>
          )}

          <button
            onClick={() => {
              sessionStorage.removeItem('panam_welcome_celebrated');
              void signOut();
            }}
            title="Sign Out"
            className="p-1.5 hover:bg-[#FF4343] hover:text-white border-2 border-transparent hover:border-[#121212] transition-colors cursor-pointer"
          >
            <LogOut size={16} strokeWidth={2.5} />
          </button>
        </div>

      </div>
    </header>
  );
};
