require 'tasks'

TESTS = FileList["tests/**/*"]
DEPS = [FileList["src/**/*.js"], FileList['styles/**/*.*'], KENDO_CONFIG_FILE, TESTS].flatten
SUPPORTED_JQUERY_VERSIONS = ["2.2.3", "3.0.0"]
JSHINT_FILES = FileList[JSON.parse(File.read("package.json"))['jshintFiles']]

scripts_arg =  "--scripts=kendo.{all,aspnetmvc}.js"
styles_arg =  "--styles={web/kendo.common.less,mobile/kendo.mobile.all.less,dataviz/kendo.dataviz.less,web/kendo.rtl.less}"
namespace :tests do
    task :java do
        mvn(POM, 'clean test')
    end

    task :aspnetmvc do
        msbuild "wrappers/mvc/Kendo.Mvc.sln"
        sh "build/xunit/xunit.console.clr4.exe wrappers/mvc/tests/Kendo.Mvc.Tests/bin/Release/Kendo.Mvc.Tests.dll"

        sh "cd wrappers/mvc-6 && dotnet restore && dotnet test tests/Kendo.Mvc.Tests"
    end

    task :spreadsheet => ["spreadsheet:binaries"] do
        msbuild SPREADSHEET_ROOT  + '/Telerik.Web.Spreadsheet.sln', "/p:Configuration=Debug"
        sh "build/xunit-2.0/xunit.console.exe #{SPREADSHEET_ROOT }/Telerik.Web.Spreadsheet.Tests/bin/Debug/Telerik.Web.Spreadsheet.Tests.dll"
    end

    desc "Run tests in supported jQuery versions"
    task :jquery => DEPS do
        SUPPORTED_JQUERY_VERSIONS.each do |version|
            gulp_xvfb "ci", "--junit-results=jquery-#{version}-test-results.xml", "--single-run=true", "--jquery=#{version}", "--skip-cultures", "--skip-source-maps", scripts_arg, styles_arg
        end
    end

    desc "Run tests in jQuery 3.0.0"
    task :jquery3 => DEPS do
        gulp_xvfb "ci", "--junit-results=jquery-3.0.0-test-results.xml", "--single-run=true", "--jquery=3.0.0", "--skip-cultures", "--skip-source-maps", scripts_arg, styles_arg
    end

    desc "Run tests in firefox"
    task :firefox => DEPS do
        gulp_xvfb "ci", "--junit-results=firefox-test-results.xml", "--single-run=true", "--browser=Firefox", "--skip-cultures", "--skip-source-maps", scripts_arg, styles_arg
    end

    desc "Run jshint"
    task :jshint => JSHINT_FILES do
        gulp "jshint"
    end

    %w[CI Production TZ].each do |env|
        output = "#{env}-test-results.xml"

        file output => DEPS do |t|
            gulp_xvfb "ci", "--junit-results=#{output}", "--single-run=true", "--skip-cultures", "--skip-source-maps", scripts_arg, styles_arg
        end

        desc "Run #{env} tests"
        task env => [:jshint, output, :java] do
            sh "touch #{output}"
        end
    end
end