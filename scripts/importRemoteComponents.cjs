const fs = require('fs')
const path = require('path')

// Directory where your Vue files are stored
const srcDir = path.join(__dirname, '../', 'src')
const componentsModule = 'main_repository'

const getExposedModules = () => {
  const mainRepositoryModulesDir = path.join(__dirname, '../', '../', 'main-repository', 'build_data')
  const exposedModuleFile = path.join(mainRepositoryModulesDir, 'exposed_modules.json')
  fs.accessSync(exposedModuleFile)
  return JSON.parse(fs.readFileSync(exposedModuleFile, { encoding: 'utf-8' }))
}

const componentsToCheck = getExposedModules()

// Function to recursively read through a directory
function readDirRecursively(directory) {
  const filesInDirectory = fs.readdirSync(directory)
  for (const file of filesInDirectory) {
    const absolute = path.join(directory, file)
    if (fs.statSync(absolute).isDirectory()) {
      readDirRecursively(absolute)
    } else {
      checkAndImportComponents(absolute)
    }
  }
}

// Function to check if specified components are used and import them if necessary
function checkAndImportComponents(filePath) {
  if (path.extname(filePath) === '.vue') {
    let fileContent = fs.readFileSync(filePath, { encoding: 'utf8' })
    let importStatements = ''
    const scriptTagRegex = /<script(\s+setup)?(\s+lang="ts")?>/
    // Find the match and its index
    const scriptTagMatch = fileContent.match(scriptTagRegex)
    let scriptTagIndex = scriptTagMatch ? scriptTagMatch.index : -1

    Object.keys(componentsToCheck).forEach(path => {
      if (path.includes('types') || path.includes('.typings') || path.includes('@types')) return
      const componentName = path.slice(path.lastIndexOf('/') + 1)
      const importStatement = `import ${componentName} from '${componentsModule}${path.slice(path.indexOf('/'))}';`
      const importCheckRegex = new RegExp(`import\\s+${componentName}\\s+from\\s+['"]${componentsModule}${path.slice(path.indexOf('/'))}['"];?`)
      // Check if component is used and not imported
      if (fileContent.includes(`<${componentName}`) && !importCheckRegex.test(fileContent)) {
        importStatements += `${importStatement}\n`
      }
    })

    if (importStatements && scriptTagIndex !== -1) {
      const endOfScriptTagIndex = fileContent.indexOf('>', scriptTagIndex) + 1
      fileContent = fileContent.slice(0, endOfScriptTagIndex) + '\n' + importStatements + fileContent.slice(endOfScriptTagIndex)
      fs.writeFileSync(filePath, fileContent, { encoding: 'utf8' })
      console.log(`Imported components in ${filePath}`)
    } else if (importStatements) {
      console.error(`No <script> or <script setup> tag found in ${filePath}. Cannot import components.`)
    }
  }
}

// Start the process
readDirRecursively(srcDir)
