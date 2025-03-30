const { globSync } = require('fast-glob')
const execSync = require('child_process').execSync
const path = require('path')
const fs = require('fs')

const srcDir = path.join(__dirname, '..', 'src')
const viteConfigDir = path.join(__dirname, '..', 'vite-conf')
const prodModulesFile = path.join(viteConfigDir, 'config', 'production', 'federationModules.ts')
const commonModulesFile = path.join(viteConfigDir, 'config', 'common', 'modules.ts')

const readModulesFile = () => {
  console.log('LOG: Читаем файл federationProdModules.ts...')
  if (!fs.existsSync(prodModulesFile)) {
    console.log('WARNING: Не удалось найти файл federationProdModules.ts\n')

    return []
  }
  let content = fs.readFileSync(prodModulesFile, { encoding: 'utf-8' })
  content = content.slice(content.indexOf('return {') + 'return {'.length)
  content = content.slice(0, content.indexOf('}'))

  return content.match(/\w+:/g).map(m => m.replace(':', ''))
}

const readCommonModulesFile = () => {
  console.log('LOG: Читаем файл common/modules.ts...')
  let content = fs.readFileSync(commonModulesFile, { encoding: 'utf-8' })
  content = content.slice(content.indexOf('modules = {') + 'modules {'.length)
  content = content.slice(0, content.indexOf('}'))

  return content.match(/\w+:/g).map(m => m.replace(':', ''))
}

console.log('LOG: Finding declared modules')

const modules = [...readModulesFile(), ...readCommonModulesFile()]
const modulesSet = new Set(modules)

console.log(`LOG: Founded modules: [${modules.join(', ')}]`)

const foundImportModules = new Map()

// Ищем импорты с нашими модулями
const searchForModules = filePath => {
  const content = fs.readFileSync(filePath, 'utf-8')
  const importRegex = /import\s+(?:{[^{}]+}|.*?)(?:\s+from\s+['"][^'"]+['"]|['"][^'"]+['"])/g
  const imports = content.match(importRegex)

  if (!imports) {
    return
  }

  for (const imp of imports) {
    const match = imp.match(/['"][^'"]+/g)
    if (!match) {
      console.log(`WARNING: Не удалось найти путь в импорте: ${imp}, файл: ${filePath}`)
      continue
    }

    const fullImport = match[0].replace(/['"]/, '')
    const modulePart = fullImport.match(/^[^/]+/g)
    if (!modulePart) {
      console.log(`WARNING: Не удалось найти первую часть модуля в импорте: ${imp}, файл: ${filePath}`)
      continue
    }

    if (modulesSet.has(modulePart[0])) {
      console.log(`LOG: Импорт с модулем найден: ${fullImport}`)

      const s = foundImportModules.get(modulePart[0])
      if (s) {
        s.add(fullImport)
      }
      foundImportModules.set(modulePart[0], s ?? new Set([fullImport]))
    }
  }
}

const slashesReplacer = path => {
  return path.replaceAll('\\', '/')
}

const srcPattern = slashesReplacer(path.join(srcDir, '**', '*.{vue,js,ts}'))
const ignorePattern = slashesReplacer(path.join(srcDir, '@core', 'libs', '*', '**'))
const files = globSync(srcPattern, { ignore: [ignorePattern] })

console.log('\nLOG: Ищем импорты с модулями в текущем проекте')
files.forEach(searchForModules)
console.log('LOG: Импорты успешно найдены\n')

// Пройтись по папкам с модулями
console.log('LOG: Идем в поход по папкам модулей в поисках .d.ts файлов')

const typesDir = path.join(__dirname, '..', '@types')
const typesFile = path.join(typesDir, 'remotes.d.ts')

if (!fs.existsSync(typesDir)) {
  fs.mkdirSync(typesDir)
}

if (fs.existsSync(typesFile)) {
  fs.renameSync(typesFile, path.join(typesDir, 'remotes.d.ts.bak'))
}

fs.writeFileSync(typesFile, '')

const appendImports = (moduleName, imports) => {
  console.log(`\nLOG: Смотрим модуль ${moduleName}`)

  const localImports = imports.map(s => s.replace(moduleName, '.'))
  const rootDir = path.join(__dirname, '..', '..')
  const origModuleName = moduleName

  moduleName = moduleName.replaceAll('_', '-')

  const moduleDir = path.join(rootDir, moduleName)

  if (!fs.existsSync(moduleDir)) {
    console.log(`WARNING: Не удалось найти модуль ${moduleName}. Импорты будут сгенерированы пустыми`)
    for (const imp of imports) {
      fs.appendFileSync(typesFile, `\ndeclare module '${imp}';`)
    }
  } else {
    const exposedModulesPaths = new Map()

    console.log('LOG: Пробуем найти файл build_data/exposed_modules.json')

    const exposedModulesFile = path.join(moduleDir, 'build_data', 'exposed_modules.json')
    if (fs.existsSync(exposedModulesFile)) {
      console.log('LOG: Файл exposed_modules.json успешно найден')

      const content = JSON.parse(fs.readFileSync(exposedModulesFile, { encoding: 'utf-8' }))

      for (const [imp, fullPath] of Object.entries(content)) {
        if (content[imp]) {
          exposedModulesPaths.set(imp.replace('.', origModuleName), path.join(moduleDir, fullPath))
        }
      }
    } else {
      console.log('WARNING: Файл exposed_modules.json не был найден')
    }

    console.log('LOG: Ищем файл vite-conf/config/common/plugins.ts')

    const vitePluginsFile = path.join(moduleDir, 'vite-conf', 'config', 'common', 'plugins.ts')
    if (fs.existsSync(vitePluginsFile)) {
      console.log('LOG: Файл plugins.ts успешно найден')
      let content = fs.readFileSync(vitePluginsFile, { encoding: "utf-8" })
      content = content.slice(content.indexOf('exposes:') + 'exposes:'.length)
      content = content.slice(0, content.indexOf('},') + 1)

      const matches = content.match(/['"]+[^'"]*['"]+/g)
      if (!matches) {
        console.log('WARNING: В файле plugins.ts не было найдено exposes')
      } else {
        for (let i = 0; i < matches.length - 1; i += 2) {
          const shortPath = matches[i].replaceAll(/['"]/g, '')
          const fullPath = matches[i + 1].replaceAll(/['"]/g, '')
          if (localImports.includes(shortPath)) {
            exposedModulesPaths.set(shortPath, path.join(moduleDir, fullPath))
          }
        }
      }
    } else {
      console.log('LOG: Файл plugins.ts не был найден')
    }

    console.log('LOG: Генерируем .d.ts файлы npm run tsc')

    const args = process.argv.slice(2)
    const isTsc = args.length ? args[0] === '--tsc' : false

    if (isTsc) {
      try {
        execSync(`cd ${moduleDir} && npm run tsc`)
        console.log('LOG: Сгенерировали .d.ts файлы успешно')
      } catch (e) {
        console.log('ERROR: Произошла ошибка при генерации .d.ts файлов (возможно нет команды, либо есть ошибки в тс)')
      }
    }

    console.log('LOG: Добавляем модули в remote.d.ts')
    for (const [local, full] of exposedModulesPaths.entries()) {
      console.log('\n-------------------------------')
      console.log(`LOG: Записываем модуль: ${local}`)
      let pathToDts

      if (full.endsWith('.js') || full.endsWith('.ts')) {
        pathToDts = full.slice(0, full.lastIndexOf('.')) + '.d.ts'
      } else {
        pathToDts = full + '.d.ts'
      }

      pathToDts = pathToDts.replace('src', '.typings/src')

      const localImp = local.replace('.', origModuleName)
      if (!fs.existsSync(pathToDts)) {
        console.log(`WARNING: Не удалось найти .d.ts файл для ${pathToDts}`)
        console.log(`LOG: Записываем пустой declare...`)
        console.log('-------------------------------')
        fs.appendFileSync(typesFile, `\ndeclare module '${localImp}';`)
        continue
      }

      const componentName = localImp.slice(localImp.lastIndexOf('/') + 1)

      let dtsContent = fs.readFileSync(pathToDts, { encoding: "utf-8" })

      if (dtsContent.includes('DefineComponent')) {
        dtsContent = dtsContent.replaceAll('_default', componentName)
      }

      fs.appendFileSync(typesFile, `\ndeclare module '${localImp}' {
                ${dtsContent}
            }`)
      console.log('LOG: Модуль успешно добавлен')
      console.log('-------------------------------')
    }
  }
}

for (const [module, imports] of foundImportModules.entries()) {
  appendImports(module, Array.from(imports))
}

console.log('\nLOG: Конец')
