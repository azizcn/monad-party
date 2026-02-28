import { create } from 'zustand'

const useWalletStore = create((set) => ({
    address: null,
    balance: '0',
    isConnected: false,
    chainId: null,

    setWallet: ({ address, balance, isConnected, chainId }) =>
        set({ address, balance, isConnected, chainId }),

    setBalance: (balance) => set({ balance }),
    disconnect: () => set({ address: null, balance: '0', isConnected: false, chainId: null }),
}))

export default useWalletStore
