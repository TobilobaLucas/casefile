import unittest
from copy import deepcopy
from case_engine import candidates, generate_case, public_case


class CaseEngineTests(unittest.TestCase):
    def test_500_seeds_have_exactly_one_supported_solution(self):
        culprits = set()
        for seed in range(500):
            case = generate_case(seed)
            self.assertEqual(candidates(case), {case["solution"]["suspectId"]})
            culprits.add(case["solution"]["suspectId"])
        self.assertEqual(len(culprits), 4)

    def test_conflicting_independent_facts_have_no_solution(self):
        case = deepcopy(generate_case())
        case["facts"]["locker"] = "not-a-real-locker"
        self.assertEqual(candidates(case), set())

    def test_public_contract_does_not_expose_answer(self):
        case = public_case(generate_case())
        self.assertNotIn("solution", case)
        self.assertNotIn("facts", case)
        self.assertEqual(len(case["evidence"]), 6)

    def test_reproduction_and_no_shared_mutable_templates(self):
        a = generate_case(41)
        a["suspects"][0]["badge"] = "tampered"
        self.assertEqual(generate_case(41), generate_case(41))
        self.assertNotEqual(a, generate_case(41))


if __name__ == "__main__":
    unittest.main()
