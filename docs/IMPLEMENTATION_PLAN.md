# PostBoy Implementation Plan

## Overview

PostBoy is a Postman-like API client that runs entirely in the browser with no backend or database. All data is stored locally using the File System Access API or exported as ZIP/JSON files. For the current feature set and usage, see the main [README](../README.md).

## Architecture Overview

### Core Principles
- **No Database**: All data stored in local file system
- **No Backend**: Static web deployment only
- **Browser-First**: Uses File System Access API for persistence
- **Git-Friendly**: Deterministic JSON structure for version control

### Tech Stack
- **Frontend**: React + TypeScript + Vite
- **State Management**: Zustand
- **Styling**: Tailwind CSS
- **Code Editor**: Monaco Editor
- **File System**: File System Access API (with ZIP fallback)
- **Scripting**: Web Workers (JavaScript sandbox)
- **Crypto**: WebCrypto API (AES-GCM for secrets)
- **HTTP**: Native `fetch()` API

---

## Phase 1: Foundation & Core Infrastructure

### 1.1 Project Setup
**Priority**: Critical  
**Estimated Time**: 2-3 hours

**Tasks**:
- Initialize Vite + React + TypeScript project
- Configure Tailwind CSS
- Set up project structure (src/, components/, stores/, utils/, types/)
- Install core dependencies:
  - `zustand` (state management)
  - `monaco-editor` (code editor)
  - `react-router-dom` (routing if needed)
  - `crypto-js` (for script sandbox)
- Configure TypeScript with strict mode
- Set up ESLint and Prettier
- Create basic folder structure

**Deliverables**:
- Working dev server
- Basic React app structure
- TypeScript configuration
- Tailwind CSS configured

---

### 1.2 Workspace Structure & Data Models
**Priority**: Critical  
**Estimated Time**: 4-6 hours

**Tasks**:
- Define TypeScript interfaces for:
  - `Workspace` (workspace.json structure)
  - `Collection` (collection.json structure)
  - `Folder` (folder.json structure)
  - `Request` (request.json structure)
  - `Environment` (env.json structure)
  - `Run` (run history structure)
- Create JSON schema validators
- Implement workspace layout structure:
  ```
  <workspace-root>/
    .apiclient/
      workspace.json
      index.json
      runs/
    environments/
      *.env.json
    collections/
      <CollectionName>/
        collection.json
        requests/
          *.request.json
        folders/
          <FolderName>/
            folder.json
            requests/
              *.request.json
  ```
- Create utility functions for:
  - Path resolution
  - File naming conventions
  - JSON serialization/deserialization

**Deliverables**:
- Type definitions for all data models
- JSON schema validators
- Workspace structure utilities

---

### 1.3 File System API Integration
**Priority**: Critical  
**Estimated Time**: 6-8 hours

**Tasks**:
- Implement File System Access API wrapper:
  - `openWorkspace()` - Request directory handle
  - `readFile()` - Read file from workspace
  - `writeFile()` - Write file to workspace
  - `createDirectory()` - Create directory structure
  - `listDirectory()` - List directory contents
- Implement ZIP fallback for unsupported browsers:
  - Export workspace to ZIP
  - Import workspace from ZIP
  - In-memory file system simulation
- Create workspace manager:
  - Initialize new workspace
  - Load existing workspace
  - Save workspace state
  - Auto-save functionality
- Handle file system permissions and errors

**Deliverables**:
- File System API wrapper module
- ZIP import/export functionality
- Workspace manager with auto-save

---

### 1.4 State Management Setup
**Priority**: Critical  
**Estimated Time**: 4-5 hours

**Tasks**:
- Create Zustand stores:
  - `useWorkspaceStore` - Workspace state, current workspace path
  - `useCollectionsStore` - Collections, folders, requests
  - `useEnvironmentsStore` - Environment variables
  - `useRequestStore` - Current request being edited
  - `useResponseStore` - Response data
  - `useRunnerStore` - Collection runner state
- Implement store actions:
  - CRUD operations for collections/folders/requests
  - Environment variable management
  - Request execution state
  - Workspace sync with file system

**Deliverables**:
- Zustand stores with all state management
- Store actions for all operations

---

## Phase 2: User Interface

### 2.1 Application Layout
**Priority**: High  
**Estimated Time**: 3-4 hours

**Tasks**:
- Create main application shell:
  - Header with workspace selector and actions
  - Sidebar for collections/environments
  - Main content area
  - Request/response panels
- Implement responsive layout
- Add navigation between views
- Create loading states and empty states

**Deliverables**:
- Complete application layout
- Responsive design
- Navigation structure

---

### 2.2 Collections UI
**Priority**: High  
**Estimated Time**: 6-8 hours

**Tasks**:
- Build collection tree view:
  - Collections list
  - Folders (nested)
  - Requests list
  - Drag-and-drop reordering (optional)
- Implement collection operations:
  - Create collection
  - Edit collection (name, description)
  - Delete collection
  - Create folder
  - Edit/delete folder
  - Create request
  - Edit/delete request
- Add context menus for actions
- Implement search/filter functionality

**Deliverables**:
- Functional collection tree view
- CRUD operations for collections/folders/requests

---

### 2.3 Request Editor
**Priority**: High  
**Estimated Time**: 8-10 hours

**Tasks**:
- Build request editor interface:
  - HTTP method selector (GET, POST, PUT, DELETE, etc.)
  - URL input with environment variable support
  - Query parameters editor (key-value pairs)
  - Headers editor (key-value pairs with autocomplete)
  - Body editor:
    - None
    - Form-data (key-value pairs)
    - x-www-form-urlencoded
    - Raw (Monaco Editor with syntax highlighting)
    - JSON (Monaco Editor with validation)
    - XML (Monaco Editor)
    - Text
  - Pre-request script editor (Monaco Editor)
  - Post-response script editor (Monaco Editor)
- Implement environment variable substitution preview
- Add request validation
- Save request to file system

**Deliverables**:
- Complete request editor
- Monaco Editor integration
- Environment variable substitution

---

### 2.4 Environment Editor
**Priority**: High  
**Estimated Time**: 4-5 hours

**Tasks**:
- Build environment editor:
  - List of environment variables (key-value pairs)
  - Add/edit/delete variables
  - Variable type indicators (string, secret)
  - Environment selector/switcher
  - Create new environment
  - Delete environment
- Implement secret variable encryption (WebCrypto)
- Add environment variable validation
- Show variable usage across requests

**Deliverables**:
- Environment editor UI
- Secret encryption/decryption
- Environment management

---

### 2.5 Response Viewer
**Priority**: High  
**Estimated Time**: 5-6 hours

**Tasks**:
- Build response display:
  - Status code with color coding
  - Response time
  - Headers table (key-value pairs)
  - Body viewer:
    - JSON (formatted with syntax highlighting)
    - XML (formatted)
    - HTML (rendered preview)
    - Text (plain text)
    - Raw (Monaco Editor)
  - Response size
  - Copy response functionality
  - Save response to file
- Add response history
- Implement response filtering/search

**Deliverables**:
- Complete response viewer
- Multiple format support
- Response history

---

## Phase 3: Core Functionality

### 3.1 Script Engine (Web Worker)
**Priority**: High  
**Estimated Time**: 8-10 hours

**Tasks**:
- Create Web Worker for script execution:
  - JavaScript sandbox environment
  - Security restrictions (no DOM access, limited APIs)
  - Execution time limits
  - Error handling
- Implement `pm-lite` API:
  - `pm.environment.get(key)`
  - `pm.environment.set(key, value)`
  - `pm.request.url`
  - `pm.request.headers`
  - `pm.request.body`
  - `pm.response.*` (for post-response scripts)
  - `pm.collectionVariables.*`
- Integrate `crypto-js` library:
  - `require('crypto-js')` support
  - Common crypto functions
- Add script execution logging
- Handle script errors gracefully

**Deliverables**:
- Web Worker script sandbox
- Complete pm-lite API
- Crypto-js integration

---

### 3.2 HTTP Request Executor
**Priority**: Critical  
**Estimated Time**: 6-8 hours

**Tasks**:
- Implement request execution flow:
  1. Load request data
  2. Substitute environment variables
  3. Execute pre-request script
  4. Build fetch() request
  5. Execute HTTP request
  6. Execute post-response script
  7. Display response
- Handle different body types:
  - JSON
  - Form-data
  - x-www-form-urlencoded
  - Raw text/XML
- Implement request cancellation
- Add request timeout handling
- Support custom headers
- Handle CORS issues (inform user)
- Add request/response logging

**Deliverables**:
- Complete request execution flow
- All body type support
- Error handling

---

### 3.3 Environment Variable Substitution
**Priority**: High  
**Estimated Time**: 3-4 hours

**Tasks**:
- Implement variable substitution:
  - `{{variableName}}` syntax
  - Support in URL, headers, body
  - Nested variable support
  - Collection variables
  - Environment variables
  - Global variables
- Add variable resolution order
- Show substitution preview
- Handle missing variables (warnings)

**Deliverables**:
- Variable substitution engine
- Preview functionality

---

### 3.4 Collection Runner
**Priority**: Medium  
**Estimated Time**: 8-10 hours

**Tasks**:
- Build collection runner UI:
  - Select collection/folder to run
  - Select environment
  - Run options (stop on error, delay between requests)
  - Progress indicator
  - Results summary
- Implement sequential execution:
  - Execute requests in order
  - Handle pre/post scripts
  - Pass variables between requests
  - Aggregate results
- Add run history:
  - Save run results to `.apiclient/runs/`
  - View previous runs
  - Export run results
- Handle errors and continue/stop options

**Deliverables**:
- Collection runner UI
- Sequential execution engine
- Run history

---

## Phase 4: Import/Export

### 4.1 Postman Import
**Priority**: Medium  
**Estimated Time**: 6-8 hours

**Tasks**:
- Implement Postman v2.1 collection import:
  - Parse Postman collection JSON
  - Convert to PostBoy format:
    - Collections
    - Folders
    - Requests (method, URL, headers, body)
    - Pre-request scripts
    - Post-response scripts
    - Environment variables
  - Handle edge cases:
    - Missing fields
    - Invalid data
    - Nested folders
- Create import UI:
  - File picker
  - Import preview
  - Conflict resolution
  - Import progress
- Validate imported data
- Save imported collections to workspace

**Deliverables**:
- Postman v2.1 import functionality
- Import UI
- Data validation

---

### 4.2 Export Functionality
**Priority**: Low  
**Estimated Time**: 3-4 hours

**Tasks**:
- Implement export options:
  - Export collection as JSON
  - Export environment as JSON
  - Export entire workspace as ZIP
- Add export UI
- Include metadata in exports

**Deliverables**:
- Export functionality
- Export UI

---

## Phase 5: Security & Advanced Features

### 5.1 Secret Encryption
**Priority**: Medium  
**Estimated Time**: 4-5 hours

**Tasks**:
- Implement WebCrypto AES-GCM encryption:
  - Generate encryption key (user password or device key)
  - Encrypt secret environment variables
  - Decrypt secrets when needed
  - Key management
- Add password protection option
- Secure key storage (IndexedDB with encryption)
- Handle key loss scenarios

**Deliverables**:
- Secret encryption/decryption
- Key management
- Password protection

---

### 5.2 Error Handling & Validation
**Priority**: High  
**Estimated Time**: 4-5 hours

**Tasks**:
- Add comprehensive error handling:
  - File system errors
  - Network errors
  - Script execution errors
  - Validation errors
- Create error boundary components
- Add user-friendly error messages
- Implement error logging
- Add validation for:
  - Request URLs
  - JSON bodies
  - Environment variables
  - Script syntax

**Deliverables**:
- Error handling system
- Validation utilities
- User feedback

---

## Phase 6: Testing & Polish

### 6.1 Unit Testing
**Priority**: Medium  
**Estimated Time**: 6-8 hours

**Tasks**:
- Write unit tests for:
  - Data model utilities
  - Environment variable substitution
  - File system operations (mocked)
  - Script execution (mocked)
  - Request building
- Set up testing framework (Vitest)
- Achieve >80% code coverage for core utilities

**Deliverables**:
- Unit test suite
- Test coverage report

---

### 6.2 Integration Testing
**Priority**: Medium  
**Estimated Time**: 4-5 hours

**Tasks**:
- Write integration tests for:
  - Request execution flow
  - Collection runner
  - Import/export
  - Workspace operations
- Use test HTTP server (e.g., MSW)
- Test error scenarios

**Deliverables**:
- Integration test suite

---

### 6.3 UI/UX Polish
**Priority**: Medium  
**Estimated Time**: 6-8 hours

**Tasks**:
- Improve UI consistency
- Add loading states
- Add empty states
- Improve error messages
- Add keyboard shortcuts
- Add tooltips and help text
- Improve responsive design
- Add dark mode (optional)
- Performance optimization

**Deliverables**:
- Polished UI/UX
- Better user experience

---

## Phase 7: Deployment

### 7.1 Build Configuration
**Priority**: High  
**Estimated Time**: 2-3 hours

**Tasks**:
- Configure production build:
  - Optimize bundle size
  - Code splitting
  - Asset optimization
  - Environment variables
- Set up build scripts
- Test production build locally

**Deliverables**:
- Production build configuration
- Optimized bundle

---

### 7.2 Deployment Setup
**Priority**: High  
**Estimated Time**: 3-4 hours

**Tasks**:
- Set up static hosting:
  - Cloudflare Pages
  - Configure build pipeline
  - Set up custom domain (optional)
  - Configure HTTPS
- Create deployment documentation
- Set up CI/CD (optional)
- Test deployment

**Deliverables**:
- Deployed application
- Deployment documentation

---

## Phase 8: Future Enhancements (Phase 2)

### 8.1 GitHub Integration
**Priority**: Low (Future)  
**Estimated Time**: TBD

**Tasks**:
- GitHub OAuth integration
- Repository selection
- Sync workspace with GitHub repo
- Pull/push operations
- Conflict resolution

---

### 8.2 PR Workflow
**Priority**: Low (Future)  
**Estimated Time**: TBD

**Tasks**:
- Create PR from workspace changes
- Review PR in UI
- Merge PR workflow

---

## Estimated Timeline

- **Phase 1 (Foundation)**: 16-22 hours
- **Phase 2 (UI)**: 26-33 hours
- **Phase 3 (Core Functionality)**: 25-32 hours
- **Phase 4 (Import/Export)**: 9-12 hours
- **Phase 5 (Security)**: 8-10 hours
- **Phase 6 (Testing & Polish)**: 16-21 hours
- **Phase 7 (Deployment)**: 5-7 hours

**Total MVP Estimate**: 105-137 hours (~13-17 working days)

---

## Risk Assessment

### High Risk
- **File System Access API**: Limited browser support, requires fallback
- **Web Worker Script Sandbox**: Security and performance concerns
- **CORS Issues**: May limit testing capabilities

### Medium Risk
- **Monaco Editor Integration**: Large bundle size, performance
- **State Management Complexity**: Managing file system sync with state

### Low Risk
- **Postman Import**: Well-documented format
- **Deployment**: Standard static hosting

---

## Success Criteria

1. ✅ Can create and organize collections/folders/requests
2. ✅ Can execute HTTP requests with all methods and body types
3. ✅ Environment variables work correctly
4. ✅ Pre/post scripts execute successfully
5. ✅ Collection runner works sequentially
6. ✅ Data persists to local file system
7. ✅ Postman v2.1 import works
8. ✅ Works in modern browsers (Chrome, Edge, Firefox, Safari)
9. ✅ ZIP fallback works for unsupported browsers
10. ✅ Application deploys as static site

---

## Notes

- Start with MVP features, add enhancements later
- Prioritize File System API implementation early
- Test in multiple browsers throughout development
- Consider progressive enhancement (works without File System API)
- Keep bundle size in mind (Monaco Editor is large)
