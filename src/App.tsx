import { useEffect } from 'react';
import { useWorkspaceStore } from './stores/workspaceStore';
import { useCollectionsStore } from './stores/collectionsStore';
import { useEnvironmentsStore } from './stores/environmentsStore';
import Layout from './components/Layout';
import WorkspaceSelector from './components/WorkspaceSelector';
import { fileSystemManager } from './utils/fileSystem';
import {
  consumePKCEState,
  exchangeCodeForTokens,
  getOAuth2Callback,
  type TokenResponse,
} from './utils/oauth2';

function App() {
  const { isOpen } = useWorkspaceStore();
  const { loadCollections } = useCollectionsStore();
  const { loadEnvironments } = useEnvironmentsStore();

  // Restore saved project directory from config (IndexedDB) on app load
  // so the user isn't prompted again when creating or opening a workspace
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (fileSystemManager.getProjectRootHandle()) return;
      const { getRootDirectoryHandle } = await import('./utils/directoryHandleStorage');
      const savedHandle = await getRootDirectoryHandle();
      if (!cancelled && savedHandle) {
        try {
          await savedHandle.getDirectoryHandle('.', { create: false });
          fileSystemManager.setProjectRootHandle(savedHandle as any);
        } catch {
          // Permission revoked or handle invalid – leave cleared so openWorkspace() will re-prompt
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (isOpen) {
      // Load collections and environments when workspace opens
      // Use requestAnimationFrame to ensure workspace handle is set
      const id = requestAnimationFrame(async () => {
        await loadCollections();
        await loadEnvironments();
        
        // Restore saved current environment after environments are loaded
        const { workspace } = useWorkspaceStore.getState();
        if (workspace?.currentEnvironment) {
          const { setCurrentEnvironment } = useEnvironmentsStore.getState();
          // Don't await - just set it without saving back to workspace (to avoid circular save)
          setCurrentEnvironment(workspace.currentEnvironment).catch(() => {
            // Ignore errors - environment might not exist anymore
          });
        }
      });
      return () => cancelAnimationFrame(id);
    }
  }, [isOpen, loadCollections, loadEnvironments]);

  // OAuth 2.0 Authorization Code (PKCE) popup callback: exchange code for tokens and notify caller
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (!data || data.type !== 'oauth2_callback' || !data.code || !data.state) return;
      const payload = consumePKCEState(data.state);
      if (!payload) return;
      try {
        const tokens: TokenResponse = await exchangeCodeForTokens({
          tokenUrl: payload.tokenUrl,
          code: data.code,
          redirectUri: payload.redirectUri,
          codeVerifier: payload.codeVerifier,
          clientId: payload.clientId,
        });
        const cb = getOAuth2Callback(data.state);
        if (cb) cb(tokens);
      } catch {
        getOAuth2Callback(data.state);
        // Callback not invoked on error; user can try "Get New Access Token" again
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  if (!isOpen) {
    return <WorkspaceSelector />;
  }

  return <Layout />;
}

export default App;
