
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletModalButton } from '@solana/wallet-adapter-react-ui';

function Login() {
  const { connected } = useWallet();
  const navigate = useNavigate();

  useEffect(() => {
    if (connected) {
      navigate('/welcome');
    }
  }, [connected, navigate]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 100 }}>
      <h1 style={{ color: 'green', fontSize: 32 }}>Frontend is running!</h1>
      <h2>Login with Phantom Wallet</h2>
      <WalletModalButton style={{ padding: '10px 20px', fontSize: 18 }} />
    </div>
  );
}

export default Login;
