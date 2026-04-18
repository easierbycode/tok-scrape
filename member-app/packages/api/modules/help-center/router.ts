import * as adminProcedures from "./procedures/admin";
import * as publicProcedures from "./procedures/public";

export const helpCenterRouter = {
	public: {
		listCategories: publicProcedures.listCategories,
		getCategory: publicProcedures.getCategory,
		getArticle: publicProcedures.getArticle,
		searchArticles: publicProcedures.searchArticles,
		listFeaturedArticles: publicProcedures.listFeaturedArticles,
		recordFeedback: publicProcedures.recordFeedback,
	},
	admin: {
		categories: {
			list: adminProcedures.listAllCategories,
			create: adminProcedures.createCategory,
			update: adminProcedures.updateCategory,
			delete: adminProcedures.deleteCategory,
			reorder: adminProcedures.reorderCategories,
		},
		articles: {
			list: adminProcedures.listAllArticles,
			create: adminProcedures.createArticle,
			update: adminProcedures.updateArticle,
			delete: adminProcedures.deleteArticle,
			reorder: adminProcedures.reorderArticles,
		},
	},
};
