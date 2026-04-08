export interface Article {
  id: string;
  title: string;
  subtitle: string;
  source: string;
  date: string;
  readTime?: string;
  active: boolean;
  content?: string;
}

const chinaGayRightsContent = `In the context of the recent legal changes in Taiwan, >>On May 24th Taiwan's highest court ruled in favour of guy rights and marriage equality. >>The court ruled on that marriage should not be limited to a man and a woman and ordered parliament either to change the law or award marriage rights to gay couples within two years.<< China reacted with surprising indifference and only one newspaper took notice. >>English-language newspaper took notice of a decision that would be the first to legalise gay marriage in an Asian country (not counting New Zealand). The more widely read Chinese version ignored it, as did television and other news outlets.<<<< China proved once more that it's reluctant to embrace gay rights. >>Homosexuality was removed from the health ministry's list of mental disorders only in 2001. Additionally China recently banned the depiction of homosexuals on television (not that there were many in the first place.)<< This is perplexing because Chinese spiritual >>Taoism regarded sex as neither good nor bad, while Confucianism, by encouraging close relations between master and pupils, is sometimes thought to have indirectly encouraged it.<< and artistic tradition >>In poetry of the 9th century, usually held to be the golden age of Chinese literature, it is sometimes hard to tell whether a love poem is addressed to a woman or a man. Also China's greatest novel, "The Dream of the Red Chamber", written in the late 18th century, includes both heterosexual and same-sex relations. Among literate elites, China does not seem to have shared the strong bias evident elsewhere.<< has long been relaxed about homosexuality. Two factors contribute to this lingering disdain. 1) Traditional family values remain strong. Sons are expected to represent family's good name, and are supposed to marry and have sons. >>In 2016 Peking University's sociology department carried out the largest survey of attitudes to, and among, homosexuals and other sexual minorities on behalf of the UN Development Programme. It found that 58% of respondents (gay and straight) agreed with the statement that gays are rejected by their families a higher level of rejection than occurs at work or school. Fewer than 15% of homosexuals said they had come out to their families, and more than half of those who did said they had experienced discrimination as a result.<< 2) China's not a democracy and forbids protest and activism, that helped establish gay rights in most countries. >>In most countries, gays have had to establish their rights by holding meetings and marches, arguing their case in the media. China's Communist Party does not like the public expression of rights of any kind and has squelched most discussion of gay concerns.<< However, Chinese attitudes are also changing. Young people are much more tolerant, which may in some time bring official perspective to the change. >>The Peking University survey revealed a big generation gap: 35% of those born before 1970 said they would reject a child who was gay; only 9% born after 1990 agreed. >>Though official media suppressed discussion of the pro gay-rights ruling in Taiwan, Weibo, China's Twitter, lit up with millions of reactions, most of them positive. Li Yinhe, a sociologist at the Chinese Academy of Social Sciences, pointed out that the average age of members of China's National People's Congress (the rubber-stamp parliament that would have to change marriage laws) is 49, at a time when the majority of people under the age of 35 approve of gay marriage. "Due to the influence of Taiwan, we're 14 years away from legalising it," she concluded.<<<<<`;

export const articles: Article[] = [
  {
    id: "china-gay-rights",
    title: "China's reluctance to gay rights",
    subtitle: "Despite a historically relaxed view of homosexuality, China seems reluctant to embrace gay rights",
    source: "The Economist explains",
    date: "Jun 6th 2017",
    active: true,
    content: chinaGayRightsContent,
  },
  {
    id: "future-of-work",
    title: "The future of remote work after the pandemic",
    subtitle: "How companies are rethinking office culture and what it means for employees worldwide",
    source: "Harvard Business Review",
    date: "Mar 15th 2023",
    active: false,
  },
  {
    id: "ocean-cleanup",
    title: "Can we really clean up the oceans?",
    subtitle: "New technologies promise to tackle plastic pollution, but the scale of the problem remains daunting",
    source: "Nature",
    date: "Sep 2nd 2022",
    active: false,
  },
  {
    id: "ai-creativity",
    title: "When machines learn to create",
    subtitle: "Artificial intelligence is producing art, music, and literature - raising questions about authorship",
    source: "The Atlantic",
    date: "Nov 20th 2023",
    active: false,
  },
  {
    id: "urban-farming",
    title: "The rise of vertical farms in megacities",
    subtitle: "Urban agriculture could transform how cities feed themselves in an era of climate uncertainty",
    source: "Wired",
    date: "Jan 8th 2024",
    active: false,
  },
];

export function getArticleById(articleId?: string) {
  return articles.find((article) => article.id === articleId);
}
