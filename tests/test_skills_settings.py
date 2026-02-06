from pathlib import Path

from nanobot.agent.skills import SkillsLoader


def _write_skill(base: Path, name: str, description: str) -> None:
    skill_dir = base / name
    skill_dir.mkdir(parents=True, exist_ok=True)
    (skill_dir / 'SKILL.md').write_text(
        f"---\nname: {name}\ndescription: {description}\n---\n\n# {name}\n",
        encoding='utf-8',
    )


def test_skill_settings_persist_and_filter(tmp_path: Path) -> None:
    workspace = tmp_path / 'workspace'
    builtin = tmp_path / 'builtin'
    workspace.mkdir()
    builtin.mkdir()

    _write_skill(builtin, 'alpha', 'alpha skill')
    _write_skill(builtin, 'beta', 'beta skill')

    loader = SkillsLoader(workspace=workspace, builtin_skills_dir=builtin)

    assert {item['name'] for item in loader.list_skills(filter_unavailable=False)} == {'alpha', 'beta'}

    loader.save_skill_settings(
        {
            'alpha': {'enabled': False, 'always': None},
            'beta': {'enabled': True, 'always': True},
        }
    )

    active = loader.list_skills(filter_unavailable=False)
    all_items = loader.list_skills(filter_unavailable=False, include_disabled=True)

    assert {item['name'] for item in active} == {'beta'}
    assert {item['name'] for item in all_items} == {'alpha', 'beta'}
    assert loader.get_always_skills() == ['beta']
