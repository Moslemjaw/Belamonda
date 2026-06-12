const fs = require('fs');
const content = fs.readFileSync('client/src/pages/dashboards/CsDashboard.tsx', 'utf-8');
const lines = content.split('\n');

const startIdx = 1616; // 0-indexed for 1617
const endIdx = 2735; // 0-indexed for 2736

const newBlock = `      {selectedUser ? (
        <div className="mt-6 rounded-3xl overflow-hidden border border-surface-200 shadow-[0_20px_60px_rgb(0,0,0,0.08)]">
          <UserProfilePanel 
            user={selectedUser} 
            onClose={() => { setSelectedUser(null); }} 
            onRoleChange={() => {}} 
            onStatusChange={() => {}} 
            onLoginAs={() => {}} 
          />
        </div>
      ) : (`;

lines.splice(startIdx, endIdx - startIdx + 1, newBlock);
fs.writeFileSync('client/src/pages/dashboards/CsDashboard.tsx', lines.join('\n'));
console.log("Successfully replaced the lines!");
