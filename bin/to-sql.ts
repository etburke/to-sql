#!/usr/bin/env node
import {logger, Level} from 'loge';
import * as async from 'async';
import * as optimist from 'optimist';

import {pathToIdentifier, createDatabase, createTable, readExcel, readSV} from '../index';

function exit(error?: Error) {
  if (error) {
    logger.error(`ERROR: ${error.toString()}`);
    process.exit(1);
  }
  logger.info('DONE');
  process.exit(0);
}

function main() {
  let argvparser = optimist
  .usage('Usage: to-sql --excel MySpreadsheet.xlsx')
  .options({
    database: {
      describe: 'database name to use',
      type: 'string',
    },
    excel: {
      describe: 'excel file to read (one table per worksheet)',
      type: 'string',
    },
    sv: {
      describe: 'sv files to read (one table per file)',
      type: 'array',
    },
    help: {
      alias: 'h',
      describe: 'print this help message',
      type: 'boolean',
    },
    verbose: {
      alias: 'v',
      describe: 'print extra output',
      type: 'boolean',
    },
    version: {
      describe: 'print version',
      type: 'boolean',
    },
  });

  let argv = argvparser.argv;
  logger.level = argv.verbose ? Level.debug : Level.info;

  // set the default database name if there is an excel file
  if (argv.excel) {
    argvparser = argvparser.default({
      database: pathToIdentifier(argv.excel),
    });
  }

  if (argv.help) {
    argvparser.showHelp();
  }
  else if (argv.version) {
    console.log(require('./package').version);
  }
  else {
    argvparser = argvparser.argv;
    const database = argv.database;
    const excelPaths = [...(argv.excel ? [argv.excel] : []), ...argv._.filter(arg => /\.xlsx$/.test(arg))];
    const svPaths = [...(argv.sv || []), ...argv._.filter(arg => !/\.xlsx$/.test(arg))];

    createDatabase(database, error => {
      if (error) return exit(error);

      async.parallel([
        callback => {
          async.eachSeries(excelPaths, (excelPath, callback) => {
            logger.debug('reading as excel: %s', excelPath);
            let tables = readExcel(excelPath);
            // could be async.each, no problem, but series is easier to debug
            async.eachSeries(tables, ({name, data}, callback) => {
              createTable(database, name, data, callback);
            }, callback);
          }, callback);
        },
        callback => {
          async.eachSeries(svPaths, (svPath, callback) => {
            logger.debug('reading as sv: %s', svPath);
            readSV(svPath, (error, {name, data}) => {
              if (error) return callback(error);

              createTable(database, name, data, callback);
            });
          }, callback);
        },
      ], exit);
    });
  }
}

if (require.main === module) {
  main();
}
