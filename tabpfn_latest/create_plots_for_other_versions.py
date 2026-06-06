import argparse
import tabpfn
import torch
from tabpfn.constants import ModelVersion

from core.bias_variance import (
    generate_test_data,
    generate_train_data,
    make_prediction,
    make_localised_prediction,
    calculate_bias_variance,
    make_plot,
    save_predictions,
)

VERSIONS = {
    "v2.5": ModelVersion.V2_5,
    "v3": ModelVersion.V3,
}

OUTPUT_PLOT_PATH = "../results/bias_variance_plot_{version}.png"
OUTPUT_PREDICTIONS_PATH = "../results/predictions/tabpfn_predictions_{version}.npz"
OUTPUT_LOC_PREDICTIONS_PATH = "../results/predictions/localized_tabpfn_predictions_{version}.npz"


def run_for_version(version: str, device: torch.device) -> None:
    print(f"Running for TabPFN {version} on device: {device}")

    x_test, _, p0_test = generate_test_data()
    x, y, _ = generate_train_data()

    clf = tabpfn.TabPFNClassifier.create_default_for_version(
        version=VERSIONS[version], device=device
    )

    predictions = make_prediction(clf, x, y, x_test)
    total_variances, total_squared_biases = calculate_bias_variance(predictions, p0_test)
    save_predictions(predictions, p0_test, OUTPUT_PREDICTIONS_PATH.format(version=version))

    loc_predictions = make_localised_prediction(clf, x, y, x_test)
    loc_variances, loc_squared_biases = calculate_bias_variance(loc_predictions, p0_test)
    save_predictions(loc_predictions, p0_test, OUTPUT_LOC_PREDICTIONS_PATH.format(version=version))

    make_plot(total_variances, total_squared_biases, loc_variances, loc_squared_biases, OUTPUT_PLOT_PATH.format(version=version))


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate bias-variance plots for a specific TabPFN version."
    )
    parser.add_argument(
        "version",
        choices=VERSIONS,
        help="TabPFN version label for output files (v2, v2.5, v3).",
    )
    parser.add_argument("--device", default="cpu", help="Torch device (e.g. cpu, cuda:0, cuda:1).")
    args = parser.parse_args()
    run_for_version(args.version, torch.device(args.device))


if __name__ == "__main__":
    main()
