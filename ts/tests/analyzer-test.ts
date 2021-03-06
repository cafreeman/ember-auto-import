import QUnit from 'qunit';
import broccoli from 'broccoli';
import { UnwatchedDir } from 'broccoli-source';
import quickTemp from 'quick-temp';
import { ensureDirSync, readFileSync, outputFileSync, removeSync, existsSync } from 'fs-extra';
import { join } from 'path';
import Package from '../package';
import Analyzer from '../analyzer';

const { module: Qmodule, test } = QUnit;

Qmodule('analyzer', function(hooks) {

  let builder, upstream, analyzer, pack;

  hooks.beforeEach(function() {
    quickTemp.makeOrRemake(this, 'workDir', 'auto-import-analyzer-tests');
    ensureDirSync(upstream = join(this.workDir, 'upstream'));
    pack = { babelOptions: {} };
    analyzer = new Analyzer(new UnwatchedDir(upstream), pack as Package);
    builder = new broccoli.Builder(analyzer);
  });

  hooks.afterEach(function() {
    removeSync(this.workDir);
    if (builder) {
      return builder.cleanup();
    }
  });

  test('initial file passes through', async function(assert) {
    let original = "import 'some-package';";
    outputFileSync(join(upstream, 'sample.js'), original);
    await builder.build();
    let content = readFileSync(join(builder.outputPath, 'sample.js'), 'utf8');
    assert.equal(content, original);
  });

  test('created file passes through', async function(assert) {
    await builder.build();
    let original = "import 'some-package';";
    outputFileSync(join(upstream, 'sample.js'), original);
    await builder.build();
    let content = readFileSync(join(builder.outputPath, 'sample.js'), 'utf8');
    assert.equal(content, original);
  });

  test('updated file passes through', async function(assert) {
    let original = "import 'some-package';";
    outputFileSync(join(upstream, 'sample.js'), original);
    await builder.build();

    let updated = "import 'some-package';\nimport 'other-package';";
    outputFileSync(join(upstream, 'sample.js'), updated);
    await builder.build();

    let content = readFileSync(join(builder.outputPath, 'sample.js'), 'utf8');
    assert.equal(content, updated);
  });

  test('deleted file passes through', async function(assert) {
    let original = "import 'some-package';";
    outputFileSync(join(upstream, 'sample.js'), original);
    await builder.build();

    removeSync(join(upstream, 'sample.js'));
    await builder.build();

    assert.ok(!existsSync(join(builder.outputPath, 'sample.js')), 'should not exist');
  });

  test('imports discovered in created file', async function(assert) {
    await builder.build();
    let original = "import 'some-package';";
    outputFileSync(join(upstream, 'sample.js'), original);
    await builder.build();
    assert.deepEqual(analyzer.imports, [{
      isDynamic: false,
      specifier: 'some-package',
      path: 'sample.js',
      package: pack
    }]);
  });

  test('imports remain constant in updated file', async function(assert) {
    let original = "import 'some-package';";
    outputFileSync(join(upstream, 'sample.js'), original);
    await builder.build();

    let updated = "import 'some-package';\nconsole.log('hi');";
    outputFileSync(join(upstream, 'sample.js'), updated);
    await builder.build();

    assert.deepEqual(analyzer.imports, [{
      isDynamic: false,
      specifier: 'some-package',
      path: 'sample.js',
      package: pack
    }]);
  });

  test('import added in updated file', async function(assert) {
    let original = "import 'some-package';";
    outputFileSync(join(upstream, 'sample.js'), original);
    await builder.build();

    let updated = "import 'some-package';\nimport 'other-package';";
    outputFileSync(join(upstream, 'sample.js'), updated);
    await builder.build();

    assert.deepEqual(analyzer.imports, [{
      isDynamic: false,
      specifier: 'some-package',
      path: 'sample.js',
      package: pack
    },{
      isDynamic: false,
      specifier: 'other-package',
      path: 'sample.js',
      package: pack
    }]);
  });

  test('import removed in updated file', async function(assert) {
    let original = "import 'some-package';";
    outputFileSync(join(upstream, 'sample.js'), original);
    await builder.build();

    let updated = "console.log('x');";
    outputFileSync(join(upstream, 'sample.js'), updated);
    await builder.build();

    assert.deepEqual(analyzer.imports, []);
  });

  test('import removed when file deleted', async function(assert) {
    let original = "import 'some-package';";
    outputFileSync(join(upstream, 'sample.js'), original);
    await builder.build();

    removeSync(join(upstream, 'sample.js'));
    await builder.build();

    assert.deepEqual(analyzer.imports, []);
  });

});
