import { useEffect } from 'react';
import { useWorkspaceStore } from './stores/workspaceStore';
import { useCollectionsStore } from './stores/collectionsStore';
import { useEnvironmentsStore } from './stores/environmentsStore';
import Layout from './components/Layout';
import WorkspaceSelector from './components/WorkspaceSelector';

function App() {
  const { isOpen } = useWorkspaceStore();
  const { loadCollections } = useCollectionsStore();
  const { loadEnvironments } = useEnvironmentsStore();

  // Don't auto-open workspace - let user choose
  // Auto-opening requires directory picker which interrupts user experience

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

  if (!isOpen) {
    return <WorkspaceSelector />;
  }

  return <Layout />;
}

export default App;
