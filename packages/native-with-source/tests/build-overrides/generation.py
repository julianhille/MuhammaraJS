"""Generate native build graphs without a compiler or downloaded Node headers."""

import ast
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET


def main():
    if len(sys.argv) == 2:
        node_gyp = Path(sys.argv[1]).resolve()
    elif len(sys.argv) == 1 and os.environ.get("npm_config_node_gyp"):
        node_gyp = Path(os.environ["npm_config_node_gyp"]).resolve().parents[1]
    else:
        raise SystemExit("Usage: python3 generation.py PATH_TO_NODE_GYP")
    root = Path(__file__).resolve().parents[2]
    ns = {"ms": "http://schemas.microsoft.com/developer/msbuild/2003"}
    vendor_files = {
        path: path.stat().st_mtime_ns
        for path in (root / "src/deps").rglob("*")
        if path.is_file()
    }
    targets = {}
    for wrapper, vendor in [("pdfwriter", "PDFWriter"), ("aes", "LibAesgm")]:
        original = ast.literal_eval(
            (root / "src/deps" / vendor / "binding.gyp").read_text(encoding="utf-8")
        )
        assert list(original) == ["targets"] and len(original["targets"]) == 1
        target = original["targets"][0]
        targets[vendor] = target
        metadata = {key: value for key, value in target.items() if key != "sources"}
        if vendor == "PDFWriter":
            metadata["dependencies"] = [
                item
                for item in metadata["dependencies"]
                if item != "<(module_root_dir)/src/deps/LibAesgm/binding.gyp:libaesgm"
            ]
        actual = ast.literal_eval(
            (root / "src/build-overrides" / (wrapper + ".gyp")).read_text()
        )["targets"][0]
        # Fail on vendor settings drift rather than silently losing new options.
        assert {
            key: value for key, value in actual.items() if key != "sources"
        } == metadata

    with tempfile.TemporaryDirectory(prefix="muhammara gyp ") as temporary:
        output = Path(temporary)
        python = Path(sys.executable)
        if os.name != "nt":
            # Exercise the quoted interpreter path common on Windows installations.
            (output / "python path").symlink_to(python.parent, target_is_directory=True)
            python = output / "python path" / python.name
        config = output / "config.gypi"
        for generator, platform, arch in [
            ("msvs", "win", "x64"),
            ("msvs", "win", "ia32"),
            ("make", "linux", "x64"),
        ]:
            build = output / (generator + "-" + arch)
            config.write_text(
                repr(
                    {
                        "target_defaults": {
                            "product_prefix": "",
                            "defines": ["_HAS_EXCEPTIONS=0"],
                            "default_configuration": "Release",
                            "configurations": {
                                name: {
                                    "msvs_configuration_platform": (
                                        "Win32" if arch == "ia32" else "x64"
                                    ),
                                    "msvs_windows_target_platform_version": "10.0.22621.0",
                                }
                                for name in ["Debug", "Release"]
                            },
                        },
                    }
                )
            )
            result = subprocess.run(
                [
                    sys.executable,
                    str(node_gyp / "gyp/gyp_main.py"),
                    "binding.gyp",
                    "-I",
                    str(config),
                    "-f",
                    generator,
                    "--depth=.",
                    "--no-parallel",
                    "--generator-output",
                    str(build),
                    "-Goutput_dir=.",
                    "-Gmsvs_version=2022",
                    "-DOS=" + platform,
                    "-Dtarget_arch=" + arch,
                    # Relative dependency filenames keep all generated projects
                    # under generator-output, including on a non-Windows host.
                    "-Dmodule_root_dir=<(DEPTH)",
                    "-Dmodule_name=muhammara",
                    "-Dmodule_path=" + str(output / "binding"),
                    "-Dpython=" + str(python),
                ],
                cwd=root,
                env={
                    **os.environ,
                    "GYP_MSVS_VERSION": "2022",
                    "GYP_MSVS_OVERRIDE_PATH": str(output / "virtual-vs"),
                    # GYP's MSVS XML writer needs a non-UTF-8 locale on POSIX.
                    "LC_ALL": "en_US.ISO8859-1",
                    "PYTHONCOERCECLOCALE": "0",
                    "PYTHONUTF8": "0",
                    "GYP_DEFINES": "",
                    "GYP_GENERATOR_FLAGS": "",
                    "GYP_GENERATORS": generator,
                },
                capture_output=True,
                text=True,
                timeout=90,
            )
            assert result.returncode == 0, result.stdout + result.stderr
            if generator == "msvs":
                solution = (build / "binding.sln").read_text()
                for project in [
                    "muhammara",
                    "pdfwriter",
                    "libaesgm",
                    "native_build_overrides",
                    "freetype",
                    "libjpeg",
                    "zlib",
                    "libtiff",
                    "libpng",
                    "openssl",
                ]:
                    assert project + ".vcxproj" in solution, project
                assert not (build / "src/deps/PDFWriter/binding.sln").exists()
                assert not (build / "src/deps/LibAesgm").exists()
                for wrapper, vendor, replacements in [
                    ("pdfwriter", "PDFWriter", ["Trace.cpp", "Log.cpp", "PDFDate.cpp"]),
                    (
                        "libaesgm",
                        "LibAesgm",
                        [
                            "aescrypt.c",
                            "aeskey.c",
                            "aes_ni.c",
                            "aes_modes.c",
                            "aestab.c",
                        ],
                    ),
                ]:
                    project = build / ("src/build-overrides/" + wrapper + ".vcxproj")
                    tree = ET.parse(project)
                    for item in tree.findall(".//ms:ClCompile[@Include]", ns):
                        exclusions = item.findall("ms:ExcludedFromBuild", ns)
                        if exclusions:
                            # The original must be excluded in every configuration.
                            assert len(exclusions) == 1
                            assert exclusions[0].text == "true"
                            assert "Condition" not in exclusions[0].attrib
                    sources = [
                        item.attrib["Include"].replace("\\", "/")
                        for item in tree.findall(".//ms:ClCompile[@Include]", ns)
                        if item.find("ms:ExcludedFromBuild", ns) is None
                    ]
                    target = targets[vendor]
                    expected = [
                        name
                        for name in target["sources"]
                        if name.endswith((".c", ".cpp"))
                    ]
                    assert sorted(Path(name).name for name in sources) == sorted(
                        expected
                    ), sources
                    for name in replacements:
                        source = next(
                            source for source in sources if source.endswith("/" + name)
                        )
                        assert "/native-build-overrides/" in source, source
                    for source in sources:
                        if "/native-build-overrides/" not in source:
                            assert (project.parent / source).is_file(), source
                    for compile in tree.findall(
                        ".//ms:ItemDefinitionGroup/ms:ClCompile", ns
                    ):
                        includes = {
                            (project.parent / directory).resolve()
                            for directory in compile.find(
                                "ms:AdditionalIncludeDirectories", ns
                            )
                            .text.replace("\\", "/")
                            .split(";")
                        }
                        assert root / "src/build-overrides" in includes
                        if wrapper == "pdfwriter":
                            assert root / "src/deps/PDFWriter" in includes
                            assert (
                                compile.find("ms:ExceptionHandling", ns).text == "Sync"
                            )
                            assert (
                                "_HAS_EXCEPTIONS=0"
                                not in compile.find(
                                    "ms:PreprocessorDefinitions", ns
                                ).text
                            )
                    references = tree.findall(".//ms:ProjectReference", ns)
                    assert any(
                        "native_build_overrides.vcxproj" in item.attrib["Include"]
                        for item in references
                    )
                # Follow actual link dependencies, not merely projects present in a solution.
                visited = set()

                def visit(project):
                    project = project.resolve()
                    project.relative_to(build)  # No projects beside vendor sources.
                    if project in visited:
                        return
                    visited.add(project)
                    assert "src/deps/LibAesgm" not in project.as_posix(), project
                    for reference in ET.parse(project).findall(
                        ".//ms:ProjectReference", ns
                    ):
                        visit(
                            project.parent
                            / reference.attrib["Include"].replace("\\", "/")
                        )

                visit(build / "muhammara.vcxproj")
                assert (
                    build / "src/build-overrides/libaesgm.vcxproj"
                ).resolve() in visited
                aes = ET.parse(build / "src/build-overrides/libaesgm.vcxproj")
                assert aes.find(".//ms:TargetName", ns).text == "muhammara_aesgm"
                assert aes.find(".//ms:ConfigurationType", ns).text == "StaticLibrary"
            else:
                rule = next(
                    line
                    for line in (build / "muhammara.target.mk").read_text().splitlines()
                    if line.startswith("$(obj).target/muhammara.node: $(OBJS)")
                )
                assert "src/build-overrides/muhammara_aesgm.a" in rule, rule
                assert "src/deps/LibAesgm" not in rule, rule
                for target, names in [
                    ("pdfwriter", ["Trace", "Log", "PDFDate"]),
                    (
                        "libaesgm",
                        ["aescrypt", "aeskey", "aes_ni", "aes_modes", "aestab"],
                    ),
                ]:
                    rule = (
                        build / "src/build-overrides" / (target + ".target.mk")
                    ).read_text()
                    for name in names:
                        assert "gen/native-build-overrides/" + name + ".o" in rule
                        assert "/PDFWriter/" + name + ".o" not in rule
                        assert "/LibAesgm/" + name + ".o" not in rule
            print(
                generator + " " + arch + " generation and graph checks passed",
                flush=True,
            )
    assert {
        path: path.stat().st_mtime_ns
        for path in (root / "src/deps").rglob("*")
        if path.is_file()
    } == vendor_files, "Build generation must not write into src/deps"


if __name__ == "__main__":
    main()
