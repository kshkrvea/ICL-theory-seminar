import abc
from typing import Dict, Optional
import torch


class DatasetGeneratorBase(abc.ABC):
	"""Base interface for fixed X->Y relation dataset generators."""

	def __init__(self, num_classes: int) -> None:
		self.num_classes = num_classes

	@abc.abstractmethod
	def marginal_x(self, **kwargs) -> torch.distributions.Distribution:
		"""Return the marginal distribution p_x for features."""

	@abc.abstractmethod
	def p_y_given_x(self, x: torch.Tensor, **kwargs) -> torch.Tensor:
		"""Return categorical probabilities p(y|x) with shape (n, num_classes)."""

	def sample(
		self,
		num_samples: int,
		x_kwargs: Optional[Dict[str, object]] = None,
		y_kwargs: Optional[Dict[str, object]] = None,
	) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor]:

		x_kwargs = x_kwargs or {}
		y_kwargs = y_kwargs or {}

		p_x = self.marginal_x(**x_kwargs)
		x = p_x.sample((num_samples,))

		probs = self.p_y_given_x(x, **y_kwargs)
		y = torch.distributions.Categorical(probs=probs).sample()
		
		return x, y, probs[..., 0]


class NaglerDatasetGenerator(DatasetGeneratorBase):
	"""Dn with X ~ N(0, I5) and p(y=1|x)=1/2 + sin(1^T x)/2."""

	def __init__(self, dim: int = 5) -> None:
		super().__init__(num_classes=2)
		self.dim = dim

	def marginal_x(self, **kwargs) -> torch.distributions.Distribution:
		mean = torch.zeros(self.dim)
		cov = torch.eye(self.dim)
		return torch.distributions.MultivariateNormal(mean, covariance_matrix=cov)

	def p_y_given_x(self, x: torch.Tensor, **kwargs) -> torch.Tensor:
		score = torch.sin(x.sum(dim=-1))
		p1 = 0.5 + 0.5 * score
		p0 = 1.0 - p1
		return torch.stack([p0, p1], dim=-1)
