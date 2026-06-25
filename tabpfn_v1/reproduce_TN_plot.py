import argparse
import os
import torch
import tabpfn

from core.bias_variance import (
    generate_test_data,
    generate_train_data,
    make_prediction,
    make_localised_prediction,
    calculate_bias_variance,
    make_plot,
    save_predictions,
)

TABPFN_TOKEN_ENV_VAR = "TABPFN_TOKEN"
TABPFN_TOKEN = os.environ.get(TABPFN_TOKEN_ENV_VAR, "")

SAMPLE_SIZES = [250, 500, 1000, 2000, 4000]


def main() -> None:
    parser = argparse.ArgumentParser(description="Reproduce bias-variance plot with TabPFN v1.")
    parser.add_argument("--device", default="cpu", help="Torch device (e.g. cpu, cuda:0, cuda:1).")
    parser.add_argument("--upper-bound-nn", type=int, default=500, help="Upper bound on nearest neighbors for localized prediction.")
    args = parser.parse_args()

    device = torch.device(args.device)
    upper_bound_nn = args.upper_bound_nn
    print(f"Using device: {device}")

    max_n = max(SAMPLE_SIZES)
    output_plot = f"../results/bias_variance_plot_v1_{max_n}samples_ub{upper_bound_nn}.png"
    output_preds = f"../results/predictions/tabpfn_predictions_v1_{max_n}samples_ub{upper_bound_nn}.npz"
    output_loc_preds = f"../results/predictions/localized_tabpfn_predictions_v1_{max_n}samples_ub{upper_bound_nn}.npz"

    x_test, _, p0_test = generate_test_data()
    x, y, _ = generate_train_data(SAMPLE_SIZES)

    clf = tabpfn.TabPFNClassifier(device=device)

    predictions = make_prediction(clf, x, y, x_test, SAMPLE_SIZES)
    variances, squared_biases, variance_ci, bias_ci = calculate_bias_variance(predictions, p0_test)
    save_predictions(predictions, p0_test, output_preds, SAMPLE_SIZES)
    
    loc_predictions = make_localised_prediction(clf, x, y, x_test, SAMPLE_SIZES, upper_bound_nearest_neighbors=upper_bound_nn)
    loc_variances, loc_squared_biases, loc_variance_ci, loc_bias_ci = calculate_bias_variance(loc_predictions, p0_test)
    save_predictions(loc_predictions, p0_test, output_loc_preds, SAMPLE_SIZES)

    make_plot(
        variances, 
        squared_biases, 
        loc_variances, 
        loc_squared_biases, 
        output_plot, 
        variance_ci=variance_ci, 
        bias_ci=bias_ci, 
        loc_variance_ci=loc_variance_ci, 
        loc_bias_ci=loc_bias_ci
    )

if __name__ == "__main__":
    main()
