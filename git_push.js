const { execSync } = require('child_process');

try {
    console.log('Adding files...');
    execSync('git add .', { cwd: 'C:/Users/jflor/OneDrive/Desktop/Scaner 3D' });
    
    console.log('Committing...');
    execSync('git commit -m "Fix 3D Scanner errors"', { cwd: 'C:/Users/jflor/OneDrive/Desktop/Scaner 3D' });
    
    console.log('Pushing...');
    execSync('git push origin gh-pages', { cwd: 'C:/Users/jflor/OneDrive/Desktop/Scaner 3D' });
    
    console.log('Done!');
} catch (error) {
    console.error('Error:', error.message);
}
