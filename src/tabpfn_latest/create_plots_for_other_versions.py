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

SAMPLE_SIZES = [4000, 7000, 10000, 15000, 20000]


def run_for_version(version: str, device: torch.device, upper_bound_nn: int) -> None:
    print(f"Running for TabPFN {version} on device: {device}")

    max_n = max(SAMPLE_SIZES)
    output_plot = f"../results/bias_variance_plot_{version}_{max_n}samples_ub{upper_bound_nn}.png"
    output_preds = f"../results/predictions/tabpfn_predictions_{version}_{max_n}samples_ub{upper_bound_nn}.npz"
    output_loc_preds = f"../results/predictions/localized_tabpfn_predictions_{version}_{max_n}samples_ub{upper_bound_nn}.npz"

    x_test, _, p0_test = generate_test_data()
    x, y, _ = generate_train_data(SAMPLE_SIZES)

    clf = tabpfn.TabPFNClassifier.create_default_for_version(
        version=VERSIONS[version], device=device
    )

    predictions = make_prediction(clf, x, y, x_test, SAMPLE_SIZES)
    total_variances, total_squared_biases, variance_ci, bias_ci = calculate_bias_variance(predictions, p0_test)
    save_predictions(predictions, p0_test, output_preds, SAMPLE_SIZES)

    loc_predictions = make_localised_prediction(clf, x, y, x_test, SAMPLE_SIZES, upper_bound_nearest_neighbors=upper_bound_nn)
    loc_variances, loc_squared_biases, loc_variance_ci, loc_bias_ci = calculate_bias_variance(loc_predictions, p0_test)
    save_predictions(loc_predictions, p0_test, output_loc_preds, SAMPLE_SIZES)

    make_plot(
        total_variances, 
        total_squared_biases, 
        loc_variances, 
        loc_squared_biases, 
        output_plot, 
        variance_ci=variance_ci, 
        bias_ci=bias_ci, 
        loc_variance_ci=loc_variance_ci, 
        loc_bias_ci=loc_bias_ci
    )


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
    parser.add_argument("--upper-bound-nn", type=int, default=10000, help="Upper bound on nearest neighbors for localized prediction.")
    args = parser.parse_args()
    run_for_version(args.version, torch.device(args.device), args.upper_bound_nn)


if __name__ == "__main__":
    main()
